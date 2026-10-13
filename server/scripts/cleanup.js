import { cleanupExpired } from '../src/lib/cleanup.js';
import { pool } from '../src/lib/db.js';

const n = await cleanupExpired();
console.log(`removed ${n} expired file(s)`);
await pool.end();
