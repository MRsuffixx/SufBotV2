import { defineConfig } from 'vitest/config';

// Env vars that need to be present in test workers.  These are passed
// to vitest and propagated to child processes; setting them here is
// the only reliable way to make them available inside the sandboxed
// VM.
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

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    env: {
      DISCORD_TOKEN: 'test-token-which-is-long-enough-to-pass-zod',
      DISCORD_CLIENT_ID: '123456789012345678',
      DISCORD_CLIENT_SECRET: 'test-secret',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
      SESSION_SECRET: 'a'.repeat(64),
      NODE_ENV: 'test',
    },
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/_*.ts'],
    },
  },
});
