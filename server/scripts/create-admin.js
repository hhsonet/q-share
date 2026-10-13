// Usage: ADMIN_PASSWORD='...' node scripts/create-admin.js <username>
// Creates the admin user, or resets its password and re-enables admin if it exists.
import { hashPassword } from '../src/lib/auth.js';
import { pool } from '../src/lib/db.js';

const username = (process.argv[2] || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';

if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
  console.error('Usage: ADMIN_PASSWORD=... node scripts/create-admin.js <username>  (3-50 chars: a-z 0-9 . _ -)');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Set ADMIN_PASSWORD (at least 8 characters).');
  process.exit(1);
}

const hash = await hashPassword(password);
const [rows] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
if (rows[0]) {
  await pool.query('UPDATE users SET password_hash = ?, is_admin = 1 WHERE id = ?', [hash, rows[0].id]);
  await pool.query('DELETE FROM sessions WHERE user_id = ?', [rows[0].id]);
  console.log(`admin "${username}" updated`);
} else {
  await pool.query('INSERT INTO users (username, password_hash, is_admin, created_at) VALUES (?, ?, 1, ?)', [username, hash, new Date()]);
  console.log(`admin "${username}" created`);
}
await pool.end();
