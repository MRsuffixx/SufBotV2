import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BotContainer } from './container.js';
import type { CommandRegistry } from './command-registry.js';
import type { CommandModule, EventModule, BotModule } from '../types/modules.js';

const SUPPORTED_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts'];

interface LoaderDeps {
  container: BotContainer;
  registry: CommandRegistry;
  baseDir: string;
  /** When true, the loader expects compiled JS in `dist/`.  Default: false. */
  fromDist?: boolean;
}

/**
 * Walk a directory recursively, returning every file path that matches
 * `predicate`.  Skips dotfiles, node_modules and the test directory.
 */
async function walk(dir: string, predicate: (filePath: string) => boolean): Promise<string[]> {
  const results: string[] = [];
  let entries: import('node:fs').Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walk(full, predicate)));
    } else if (entry.isFile() && predicate(full)) {
      results.push(full);
    }
  }
  return results;
}

function isCodeFile(filePath: string): boolean {
  const ext = path.extname(filePath);
  return SUPPORTED_EXTENSIONS.includes(ext);
}

async function importModule(filePath: string): Promise<unknown> {
  if (filePath.endsWith('.ts') && process.env.NODE_ENV !== 'production') {
    // tsx registers a loader for .ts files; importing works.
    return import(filePath);
  }
  return import(pathToFileURL(filePath).href);
}

/**
 * Dynamically load every command module in `<baseDir>/commands`.  A command
 * module is a file that exports a `CommandModule` as its default export.
 */
export async function loadCommands(deps: LoaderDeps): Promise<CommandModule[]> {
  const dir = path.join(deps.baseDir, 'commands');
  try {
    await stat(dir);
  } catch {
    return [];
  }
  const files = await walk(dir, (p) => isCodeFile(p) && !p.endsWith('.d.ts'));
  const commands: CommandModule[] = [];
  for (const file of files) {
    try {
      const mod = (await importModule(file)) as { default?: CommandModule };
      if (!mod.default || typeof mod.default.execute !== 'function') continue;
      if (!mod.default.data || typeof mod.default.data.name !== 'string') {
        throw new Error(`Missing "data" or "data.name" in ${file}`);
      }
      deps.registry.register(mod.default);
      commands.push(mod.default);
    } catch (err) {
      deps.container.logger().error(`Failed to load command at ${file}`, err);
      throw err;
    }
  }
  return commands;
}

/**
 * Dynamically load every event module in `<baseDir>/events`.  Each event
 * module is registered with the discord.js Client.
 */
export async function loadEvents(deps: LoaderDeps): Promise<EventModule[]> {
  const dir = path.join(deps.baseDir, 'events');
  try {
    await stat(dir);
  } catch {
    return [];
  }
  const files = await walk(dir, (p) => isCodeFile(p) && !p.endsWith('.d.ts'));
  const events: EventModule[] = [];
  const client = deps.container.client();
  for (const file of files) {
    try {
      const mod = (await importModule(file)) as { default?: EventModule };
      if (!mod.default || typeof mod.default.execute !== 'function') continue;
      const { name, once, execute } = mod.default;
      if (!name) throw new Error(`Event module ${file} is missing "name"`);
      const handler = (...args: unknown[]) => {
        Promise.resolve()
          .then(() => execute(...args))
          .catch((err) => {
            deps.container.logger().error(`Unhandled error in event "${name}"`, err);
          });
      };
      if (once) client.once(name, handler);
      else client.on(name, handler);
      events.push(mod.default);
    } catch (err) {
      deps.container.logger().error(`Failed to load event at ${file}`, err);
      throw err;
    }
  }
  return events;
}

/**
 * Load and initialise every module in `<baseDir>/modules`.  Modules are
 * higher-level features (auto-moderation, music, analytics) that need to
 * hook into the bot lifecycle.
 */
export async function loadModules(deps: LoaderDeps): Promise<BotModule[]> {
  const dir = path.join(deps.baseDir, 'modules');
  try {
    await stat(dir);
  } catch {
    return [];
  }
  const files = await walk(dir, (p) => isCodeFile(p) && !p.endsWith('.d.ts'));
  const modules: BotModule[] = [];
  for (const file of files) {
    const mod = (await importModule(file)) as { default?: BotModule };
    if (!mod.default || typeof mod.default.init !== 'function') continue;
    await mod.default.init(deps.container);
    modules.push(mod.default);
  }
  return modules;
}
