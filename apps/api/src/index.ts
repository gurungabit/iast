// ============================================================================
// API Entry Point
// ============================================================================

import { buildApp } from './server';
import { config } from './config';

async function main(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({
      host: config.server.host,
      port: config.server.port,
    });

    app.log.info(`Server listening on http://${config.server.host}:${config.server.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch(console.error);
