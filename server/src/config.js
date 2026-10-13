import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const int = (v, d) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

const DEFAULT_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'heic', 'avif',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf',
  'txt', 'md', 'csv', 'json', 'xml', 'log',
  'zip', 'rar', '7z', 'tar', 'gz', 'tgz',
  'mp3', 'wav', 'ogg', 'flac', 'm4a',
  'mp4', 'mov', 'webm', 'mkv', 'avi',
].join(',');

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 4000),
  host: process.env.HOST || '127.0.0.1',
  trustProxy: process.env.TRUST_PROXY === 'true',
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/+$/, ''),
  corsOrigin: process.env.CORS_ORIGIN || '',
  clientDist: path.resolve(root, process.env.CLIENT_DIST || '../client/dist'),

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: int(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'quickshare',
  },

  // Must live outside any publicly served directory.
  storageDir: path.resolve(root, process.env.STORAGE_DIR || './storage'),
  maxFileSize: int(process.env.MAX_FILE_SIZE_MB, 100) * 1024 * 1024,
  maxFilesPerRequest: int(process.env.MAX_FILES_PER_REQUEST, 10),
  allowedExtensions: new Set(
    (process.env.ALLOWED_EXTENSIONS || DEFAULT_EXTENSIONS)
      .split(',')
      .map((s) => s.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean),
  ),
  // 0 = files never expire.
  expiryHours: int(process.env.FILE_EXPIRY_HOURS, 168),
  cleanupIntervalMinutes: int(process.env.CLEANUP_INTERVAL_MINUTES, 60),

  rateLimit: {
    windowMs: int(process.env.RATE_LIMIT_WINDOW_MINUTES, 15) * 60 * 1000,
    max: int(process.env.RATE_LIMIT_MAX, 300),
    uploadMax: int(process.env.UPLOAD_RATE_LIMIT_MAX, 60),
    authMax: int(process.env.AUTH_RATE_LIMIT_MAX, 20),
  },
};

// Never allowed, even if listed in ALLOWED_EXTENSIONS.
export const BLOCKED_EXTENSIONS = new Set([
  'exe', 'dll', 'msi', 'com', 'scr', 'bat', 'cmd', 'ps1', 'vbs', 'vbe', 'js', 'mjs',
  'jar', 'sh', 'bash', 'php', 'phtml', 'phar', 'asp', 'aspx', 'jsp', 'cgi', 'pl', 'py',
  'rb', 'html', 'htm', 'xhtml', 'svg', 'hta', 'lnk', 'reg', 'apk', 'app', 'deb', 'rpm', 'so',
  'elf', 'bin', 'wsf', 'cpl', 'msc',
]);
