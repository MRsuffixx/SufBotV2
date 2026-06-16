// Ensure required env vars are present before any module reads them.
process.env['DISCORD_TOKEN'] = process.env['DISCORD_TOKEN'] ?? 'test-token';
process.env['DISCORD_CLIENT_ID'] =
  process.env['DISCORD_CLIENT_ID'] ?? '123456789012345678';
process.env['DISCORD_CLIENT_SECRET'] =
  process.env['DISCORD_CLIENT_SECRET'] ?? 'test-secret';
process.env['DATABASE_URL'] =
  process.env['DATABASE_URL'] ?? 'postgresql://user:pass@localhost:5432/test';
process.env['SESSION_SECRET'] =
  process.env['SESSION_SECRET'] ?? 'a'.repeat(64);
process.env['NODE_ENV'] = process.env['NODE_ENV'] ?? 'test';

// Clear the env cache so each test run re-reads the current process.env.
import { __resetEnvForTest } from './src/config/env.js';
__resetEnvForTest();
