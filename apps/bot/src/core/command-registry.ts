import { Collection } from 'discord.js';
import type { CommandModule } from '../types/modules.js';

/**
 * Holds all loaded commands.  This is the single source of truth used by
 * the interaction dispatcher and the REST registration step.
 */
export class CommandRegistry {
  private readonly collection = new Collection<string, CommandModule>();
  private readonly cooldowns = new Map<string, Map<string, number>>();

  register(command: CommandModule): void {
    const name = command.data.name;
    if (this.collection.has(name)) {
      throw new Error(`Command "${name}" registered twice`);
    }
    this.collection.set(name, command);
  }

  get(name: string): CommandModule | undefined {
    return this.collection.get(name);
  }

  all(): Collection<string, CommandModule> {
    return this.collection;
  }

  /**
   * Per-user cooldowns keyed by `<commandName>:<userId>`.  The expiry is
   * stored as a Unix epoch in ms; `null` means no cooldown was set.
   */
  isOnCooldown(commandName: string, userId: string): { onCooldown: boolean; remainingMs: number } {
    const map = this.cooldowns.get(commandName);
    const expiresAt = map?.get(userId);
    if (!expiresAt) return { onCooldown: false, remainingMs: 0 };
    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) {
      map?.delete(userId);
      return { onCooldown: false, remainingMs: 0 };
    }
    return { onCooldown: true, remainingMs };
  }

  setCooldown(commandName: string, userId: string, seconds: number): void {
    if (seconds <= 0) return;
    let map = this.cooldowns.get(commandName);
    if (!map) {
      map = new Map();
      this.cooldowns.set(commandName, map);
    }
    map.set(userId, Date.now() + seconds * 1000);
  }
}
