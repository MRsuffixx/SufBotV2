import type { Client } from 'discord.js';
import type { Logger } from '../utils/logger.js';
import type { PrismaClient } from '@prisma/client';
import type { BotEnv } from '../config/env.js';
import { TOKENS, type Token } from './symbols.js';

type ServiceFactory<T> = (container: BotContainer) => T | Promise<T>;

interface ServiceEntry {
  factory: ServiceFactory<unknown>;
  singleton: boolean;
  instance?: unknown;
}

/**
 * Tiny but strict dependency-injection container.
 *
 * - Services are registered as factories that receive the container so they
 *   can resolve other services.
 * - By default registrations are singletons, but callers can opt-out with
 *   `{ singleton: false }` to get a new instance per resolve.
 * - Async factories are awaited transparently, allowing initialization steps
 *   (e.g. database connection warm-up) to happen once at boot.
 *
 * The container is intentionally synchronous in its API: callers that need
 * async initialisation should `await container.init()` during boot.
 */
export class BotContainer {
  private readonly entries = new Map<Token | string, ServiceEntry>();

  register<T>(token: Token | string, factory: ServiceFactory<T>, opts?: { singleton?: boolean }): this {
    this.entries.set(token, {
      factory: factory as ServiceFactory<unknown>,
      singleton: opts?.singleton !== false,
    });
    return this;
  }

  has(token: Token | string): boolean {
    return this.entries.has(token);
  }

  get<T>(token: Token): T;
  get<T>(token: string): T;
  get<T>(token: Token | string): T {
    const entry = this.entries.get(token);
    if (!entry) {
      throw new Error(`No service registered for token: ${String(token)}`);
    }
    if (entry.singleton) {
      if (entry.instance === undefined) {
        const result = entry.factory(this);
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          throw new Error(
            `Service "${String(token)}" was registered as a singleton but returned a Promise. ` +
              `Call \`await container.init()\` first or register as \`{ singleton: false }\`.`,
          );
        }
        entry.instance = result;
      }
      return entry.instance as T;
    }
    return entry.factory(this) as T;
  }

  /**
   * Awaited once at boot to initialise any service whose factory is async.
   * Returns a map of token -> resolved instance for inspection (mostly used
   * by tests).
   */
  async init(): Promise<Map<Token | string, unknown>> {
    const resolved = new Map<Token | string, unknown>();
    for (const [token, entry] of this.entries.entries()) {
      if (entry.instance !== undefined) {
        resolved.set(token, entry.instance);
        continue;
      }
      const result = entry.factory(this);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        entry.instance = await (result as Promise<unknown>);
      } else {
        entry.instance = result;
      }
      resolved.set(token, entry.instance);
    }
    return resolved;
  }

  /**
   * Typed accessors for the well-known services.  These are convenience
   * methods — services are still registered through the generic API so
   * plugins can override them.
   */
  logger(): Logger {
    return this.get<Logger>(TOKENS.Logger);
  }
  client(): Client {
    return this.get<Client>(TOKENS.Client);
  }
  database(): PrismaClient {
    return this.get<PrismaClient>(TOKENS.Database);
  }
  config(): BotEnv {
    return this.get<BotEnv>(TOKENS.Config);
  }
}
