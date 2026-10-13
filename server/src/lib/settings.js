import { config } from '../config.js';
import { pool } from './db.js';

/** Default expiry for new uploads, in hours (0 = never). Admin setting overrides FILE_EXPIRY_HOURS. */
export async function getExpiryHours() {
  const [rows] = await pool.query("SELECT value FROM settings WHERE name = 'expiry_hours' LIMIT 1");
  const n = rows[0] ? Number.parseInt(rows[0].value, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : config.expiryHours;
}

export async function setExpiryHours(hours) {
  await pool.query(
    `INSERT INTO settings (name, value, updated_at) VALUES ('expiry_hours', ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)`,
    [String(hours), new Date()],
  );
}
