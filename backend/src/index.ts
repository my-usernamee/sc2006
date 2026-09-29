/**
 * Start-up class (Fox heuristic, Lab 3 section 3.1.3).
 * Checks the configuration, makes sure the uploads folder exists, and starts
 * listening. This is the only file that starts a server.
 */
import fs from 'fs';
import { createApp } from './app';
import { env, UPLOAD_DIR } from './config/env';
import { prisma } from './lib/prisma';

async function main() {
  // Create the uploads folder on first run so image saving cannot fail.
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  // Fail loudly at start-up rather than on the first request.
  await prisma.$connect();

  createApp().listen(env.port, () => {
    console.log(`FoundIt API listening on http://localhost:${env.port}`);
  });
}

main().catch((error) => {
  console.error('Failed to start the FoundIt server:');
  console.error(error);
  process.exit(1);
});
