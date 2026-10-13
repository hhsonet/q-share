import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromFile } from 'file-type';
import { config, BLOCKED_EXTENSIONS } from '../config.js';

const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  bmp: 'image/bmp', ico: 'image/x-icon', heic: 'image/heic', avif: 'image/avif',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation', rtf: 'application/rtf',
  txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json',
  xml: 'application/xml', log: 'text/plain',
  zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar', gz: 'application/gzip', tgz: 'application/gzip',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
};

// Detected content types that must never be stored, whatever the extension says.
const BLOCKED_DETECTED = new Set(['exe', 'elf', 'msi', 'dll', 'macho', 'class', 'dmg', 'deb', 'rpm', 'apk', 'jar']);

export const getExtension = (name) => path.extname(name).slice(1).toLowerCase();

/** Strip path components, control chars and reserved chars; cap length. */
export function sanitizeOriginalName(raw) {
  // multer decodes the header as latin1; recover UTF-8.
  let name = Buffer.from(String(raw ?? ''), 'latin1').toString('utf8');
  if (name.includes('�')) name = String(raw);
  name = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  name = name.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').replace(/^\.+/, '').trim();
  if (name.length > 200) {
    const ext = path.extname(name);
    name = name.slice(0, 200 - ext.length) + ext;
  }
  return name || 'file';
}

export function checkExtension(name, allowed = config.allowedExtensions) {
  const ext = getExtension(name);
  if (!ext) return 'Files without an extension are not allowed.';
  // Reject double extensions that hide a blocked one, e.g. "a.php.txt".
  const hidden = name.toLowerCase().split('.').slice(1).find((p) => BLOCKED_EXTENSIONS.has(p));
  if (hidden) return `File type ".${hidden}" is not allowed.`;
  if (!allowed.has(ext)) return `File type ".${ext}" is not allowed.`;
  return null;
}

export async function checkContent(filePath) {
  try {
    const detected = await fileTypeFromFile(filePath);
    if (detected && BLOCKED_DETECTED.has(detected.ext)) return 'File content is not allowed.';
  } catch {
    /* detection failure is not fatal */
  }
  return null;
}

export const mimeFor = (name) => MIME_BY_EXT[getExtension(name)] || 'application/octet-stream';

export const newPublicId = () => crypto.randomBytes(18).toString('base64url'); // 24 chars, 144 bits
export const newStoredName = () => crypto.randomBytes(20).toString('hex');
export const newOwnerToken = () => crypto.randomBytes(32).toString('hex');
export const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

export const PUBLIC_ID_RE = /^[A-Za-z0-9_-]{24}$/;
const STORED_NAME_RE = /^[a-f0-9]{40}$/;

export function storagePath(storedName) {
  if (!STORED_NAME_RE.test(storedName)) throw new Error('invalid stored name');
  return path.join(config.storageDir, storedName.slice(0, 2), storedName);
}

export const tmpDir = () => path.join(config.storageDir, '_tmp');

export async function ensureStorage() {
  await fs.mkdir(tmpDir(), { recursive: true });
}

export async function moveIntoStorage(tmpPath, storedName) {
  const dest = storagePath(storedName);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.rename(tmpPath, dest);
}

export async function removeStored(storedName) {
  try {
    await fs.unlink(storagePath(storedName));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

/** Whether the viewer ({ ownerHash, user }) owns this row. */
export function isOwnerOf(row, viewer) {
  if (viewer.user?.isAdmin) return true; // admins can manage every file
  if (row.user_id != null) return !!viewer.user && Number(row.user_id) === viewer.user.id;
  return !!viewer.ownerHash && row.owner_hash === viewer.ownerHash;
}

export function toDto(row, viewer) {
  return {
    kind: 'file',
    id: row.public_id,
    name: row.original_name,
    extension: getExtension(row.original_name),
    mimeType: row.mime_type,
    size: Number(row.size),
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    downloadCount: row.download_count,
    isPublic: !!row.is_public,
    isOwner: isOwnerOf(row, viewer),
  };
}
