export * from './client.js';
export * as repositories from './repositories/index.js';
// Re-export individual repositories and their types for ergonomic imports
// like `import { userRepository } from '@bot/database'`.
export {
  userRepository,
  guildRepository,
  guildSettingsRepository,
  warningRepository,
  auditLogRepository,
  sessionRepository,
} from './repositories/index.js';
export type {
  UpsertUserInput,
} from './repositories/user.repository.js';
export type {
  UpsertGuildInput,
} from './repositories/guild.repository.js';
export type {
  UpdateGuildSettingsInput,
} from './repositories/guild-settings.repository.js';
export type {
  CreateWarningInput,
} from './repositories/warning.repository.js';
export type {
  RecordAuditLogInput,
} from './repositories/audit-log.repository.js';
export type {
  CreateSessionInput,
  CreatedSession,
} from './repositories/session.repository.js';
