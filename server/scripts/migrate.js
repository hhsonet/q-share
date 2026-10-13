import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../src/config.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');
const { database, ...conn } = config.db;

const admin = await mysql.createConnection(conn);
await admin.query(
  `CREATE DATABASE IF NOT EXISTS \`${database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
);
await admin.end();

const db = await mysql.createConnection({ ...conn, database, multipleStatements: true });
await db.query(
  'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at DATETIME NOT NULL)',
);
const [done] = await db.query('SELECT name FROM schema_migrations');
const applied = new Set(done.map((r) => r.name));

for (const f of (await fs.readdir(dir)).filter((n) => n.endsWith('.sql')).sort()) {
  if (applied.has(f)) continue;
  console.log('applying', f);
  await db.query(await fs.readFile(path.join(dir, f), 'utf8'));
  await db.query('INSERT INTO schema_migrations (name, applied_at) VALUES (?, UTC_TIMESTAMP())', [f]);
}
console.log('migrations up to date');
await db.end();
