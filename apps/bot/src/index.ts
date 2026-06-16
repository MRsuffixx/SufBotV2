import { startBot } from './core/bot.js';

async function main(): Promise<void> {
  const shutdown = await startBot();

  const handleSignal = (signal: NodeJS.Signals) => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}, shutting down...`);
    shutdown()
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Error during shutdown', err);
      })
      .finally(() => process.exit(0));
  };
  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error starting bot:', err);
  process.exit(1);
});
