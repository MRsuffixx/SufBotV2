/**
 * Symbol-based service identifiers for the DI container.  Using symbols
 * instead of string keys prevents accidental collisions and supports
 * type-safe resolution via the `Container.get<T>(token)` method.
 */
export const TOKENS = {
  Logger: Symbol.for('bot.Logger'),
  Client: Symbol.for('bot.Client'),
  Database: Symbol.for('bot.Database'),
  Config: Symbol.for('bot.Config'),
  CommandLoader: Symbol.for('bot.CommandLoader'),
  EventLoader: Symbol.for('bot.EventLoader'),
  RateLimiter: Symbol.for('bot.RateLimiter'),
  CommandRegistry: Symbol.for('bot.CommandRegistry'),
  AuditService: Symbol.for('bot.AuditService'),
  GuildSettingsService: Symbol.for('bot.GuildSettingsService'),
  ModerationService: Symbol.for('bot.ModerationService'),
  BotStatsService: Symbol.for('bot.BotStatsService'),
} as const;

export type Token = (typeof TOKENS)[keyof typeof TOKENS];
