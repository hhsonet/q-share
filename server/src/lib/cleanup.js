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

export async function cleanupSessions() {
  await pool.query('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()');
}

// Drop expired bundles and empty bundles left behind by failed uploads (older than 1 hour).
export async function cleanupBundles() {
  await pool.query(
    `DELETE b FROM bundles b
     WHERE (b.expires_at IS NOT NULL AND b.expires_at <= UTC_TIMESTAMP())
        OR (b.created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR)
            AND NOT EXISTS (SELECT 1 FROM files f WHERE f.bundle_id = b.id))`,
  );
}
