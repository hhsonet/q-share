import { cleanupExpired, cleanupSessions } from '../src/lib/cleanup.js';
import { pool } from '../src/lib/db.js';

const n = await cleanupExpired();
await cleanupSessions();
console.log(`removed ${n} expired file(s)`);
await pool.end();
