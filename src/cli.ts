import { readFile } from 'node:fs/promises';
import { createClient } from 'redis';
import { exportEntries, parseArgs, parseConfig } from './exporter.js';

async function main() {
  const { verbose, path } = parseArgs(process.argv.slice(2));
  const entries = parseConfig(await readFile(path, 'utf8'));
  const client = createClient({
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    socket: { connectTimeout: 5000, reconnectStrategy: false },
  });
  client.on('error', () => {}); // Connection/command failures are handled below.
  try {
    await client.connect();
    const keys = await exportEntries(entries, client);
    if (verbose) for (const key of keys) console.log(key);
    console.error(`Saved ${keys.length} keys to Redis.`);
  } finally {
    if (client.isOpen) client.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
