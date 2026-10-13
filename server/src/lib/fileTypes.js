import { config } from '../config.js';
import { pool } from './db.js';

// Admin-selectable groups of file extensions.
export const CATEGORIES = [
  { key: 'pdf', label: 'PDF', extensions: ['pdf'] },
  { key: 'word', label: 'Word', extensions: ['doc', 'docx', 'odt', 'rtf'] },
  { key: 'powerpoint', label: 'PowerPoint', extensions: ['ppt', 'pptx', 'odp'] },
  { key: 'text', label: 'Text', extensions: ['txt', 'md', 'csv', 'json', 'xml', 'log'] },
  { key: 'image', label: 'Image', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'heic', 'avif'] },
  { key: 'spreadsheet', label: 'Spreadsheet', extensions: ['xls', 'xlsx', 'ods'] },
  { key: 'archive', label: 'Archive', extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'tgz'] },
  { key: 'audio', label: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a'] },
  { key: 'video', label: 'Video', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
];

const KEYS = new Set(CATEGORIES.map((c) => c.key));
const TTL_MS = 5000;
let cache = null; // { at, categories }

/** Enabled category keys. Defaults to every category until an admin chooses. */
export async function getAllowedCategories() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.categories;
  const [rows] = await pool.query("SELECT value FROM settings WHERE name = 'allowed_categories' LIMIT 1");
  let categories = CATEGORIES.map((c) => c.key);
  if (rows[0]) {
    try {
      const parsed = JSON.parse(rows[0].value);
      if (Array.isArray(parsed)) categories = parsed.filter((k) => KEYS.has(k));
    } catch {
      /* keep default */
    }
  }
  cache = { at: Date.now(), categories };
  return categories;
}

export async function setAllowedCategories(categories) {
  const clean = CATEGORIES.map((c) => c.key).filter((k) => categories.includes(k));
  await pool.query(
    `INSERT INTO settings (name, value, updated_at) VALUES ('allowed_categories', ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)`,
    [JSON.stringify(clean), new Date()],
  );
  cache = null;
  return clean;
}

/** Effective extension allowlist: enabled categories, limited to the ALLOWED_EXTENSIONS env cap. */
export async function getAllowedExtensions() {
  const enabled = new Set(await getAllowedCategories());
  const out = new Set();
  for (const c of CATEGORIES) {
    if (!enabled.has(c.key)) continue;
    for (const e of c.extensions) if (config.allowedExtensions.has(e)) out.add(e);
  }
  return out;
}
