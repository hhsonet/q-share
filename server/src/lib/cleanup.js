import { pool } from './db.js';
import { removeStored } from './files.js';

export async function cleanupExpired() {
  const [rows] = await pool.query(
    'SELECT id, stored_name FROM files WHERE expires_at IS NOT NULL AND expires_at <= UTC_TIMESTAMP() LIMIT 500',
  );
  let removed = 0;
  for (const r of rows) {
    try {
      await removeStored(r.stored_name);
      await pool.query('DELETE FROM files WHERE id = ?', [r.id]);
      removed++;
    } catch (e) {
      console.error('cleanup failed for file', r.id, e.code || e.message);
    }
  }
  return removed;
}
