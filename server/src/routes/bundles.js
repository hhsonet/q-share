import fs from 'node:fs';
import { ZipArchive } from 'archiver';
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../lib/db.js';
import { HttpError } from '../lib/errors.js';
import {
  PUBLIC_ID_RE, getExtension, isOwnerOf, newPublicId, removeStored, storagePath, toDto,
} from '../lib/files.js';
import { getExpiryHours } from '../lib/settings.js';

export const bundlesRouter = Router();

const ACTIVE = '(expires_at IS NULL OR expires_at > UTC_TIMESTAMP())';

export function bundleDto(row, viewer, fileCount, size) {
  return {
    kind: 'bundle',
    id: row.public_id,
    name: row.name || `${fileCount} file${fileCount === 1 ? '' : 's'}`,
    fileCount,
    size,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    isPublic: !!row.is_public,
    isOwner: isOwnerOf(row, viewer),
  };
}

export async function findBundle(publicId) {
  if (!PUBLIC_ID_RE.test(publicId)) throw new HttpError(404, 'Bundle not found.', 'NOT_FOUND');
  const [rows] = await pool.query('SELECT * FROM bundles WHERE public_id = ? LIMIT 1', [publicId]);
  const row = rows[0];
  if (!row) throw new HttpError(404, 'Bundle not found.', 'NOT_FOUND');
  if (row.expires_at && new Date(row.expires_at) <= new Date()) throw new HttpError(410, 'This link has expired.', 'EXPIRED');
  return row;
}

const memberFiles = async (bundleId) => {
  const [files] = await pool.query(
    `SELECT * FROM files WHERE bundle_id = ? AND ${ACTIVE} ORDER BY created_at ASC, id ASC`,
    [bundleId],
  );
  return files;
};

const viewerOf = (req) => ({ ownerHash: req.ownerHash, user: req.user });

// Create an empty bundle; files are then uploaded into it with the "bundle" field.
bundlesRouter.post('/', async (req, res, next) => {
  try {
    if (!req.user && !req.ownerHash) throw new HttpError(401, 'Missing or invalid owner token.', 'UNAUTHORIZED');
    const body = z
      .object({ name: z.string().trim().max(120).optional(), isPublic: z.boolean().optional() })
      .safeParse(req.body ?? {});
    if (!body.success) throw new HttpError(400, 'Invalid bundle name.', 'BAD_REQUEST');
    // Anonymous bundles are always public; signed-in users choose (default public).
    const isPublic = req.user ? body.data.isPublic !== false : true;
    const now = new Date();
    const hours = await getExpiryHours();
    const expires = hours ? new Date(now.getTime() + hours * 3600_000) : null;
    const publicId = newPublicId();
    await pool.query(
      'INSERT INTO bundles (public_id, name, owner_hash, is_public, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [publicId, body.data.name || null, req.ownerHash ?? '', isPublic ? 1 : 0, req.user ? req.user.id : null, now, expires],
    );
    const row = { public_id: publicId, name: body.data.name || null, owner_hash: req.ownerHash, is_public: isPublic, user_id: req.user?.id ?? null, created_at: now, expires_at: expires };
    res.status(201).json({ bundle: bundleDto(row, viewerOf(req), 0, 0) });
  } catch (e) {
    next(e);
  }
});

// Bundle metadata plus its files (anyone with the unguessable ID).
bundlesRouter.get('/:id', async (req, res, next) => {
  try {
    const row = await findBundle(req.params.id);
    const files = await memberFiles(row.id);
    if (!files.length) throw new HttpError(404, 'Bundle not found.', 'NOT_FOUND');
    const viewer = viewerOf(req);
    const size = files.reduce((n, f) => n + Number(f.size), 0);
    res.json({ bundle: bundleDto(row, viewer, files.length, size), files: files.map((f) => toDto(f, viewer)) });
  } catch (e) {
    next(e);
  }
});

// Download the whole bundle as a zip.
bundlesRouter.get('/:id/download', async (req, res, next) => {
  try {
    const row = await findBundle(req.params.id);
    const files = await memberFiles(row.id);
    if (!files.length) throw new HttpError(404, 'Bundle not found.', 'NOT_FOUND');

    const base = (row.name || 'bundle').replace(/[^\w.\- ]+/g, '_').trim().slice(0, 80) || 'bundle';
    res.attachment(`${base}.zip`);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');

    const zip = new ZipArchive({ zlib: { level: 1 } });
    zip.on('error', () => res.destroy());
    res.on('close', () => zip.abort());
    zip.pipe(res);

    const used = new Set();
    for (const f of files) {
      let name = f.original_name;
      for (let i = 2; used.has(name.toLowerCase()); i++) {
        const ext = getExtension(f.original_name);
        const stem = ext ? f.original_name.slice(0, -(ext.length + 1)) : f.original_name;
        name = `${stem} (${i})${ext ? `.${ext}` : ''}`;
      }
      used.add(name.toLowerCase());
      const abs = storagePath(f.stored_name);
      if (fs.existsSync(abs)) zip.file(abs, { name });
    }
    pool.query('UPDATE files SET download_count = download_count + 1 WHERE bundle_id = ?', [row.id]).catch(() => {});
    await zip.finalize();
  } catch (e) {
    next(e);
  }
});

// Delete the bundle and every file in it (owner or admin).
bundlesRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!PUBLIC_ID_RE.test(req.params.id)) throw new HttpError(404, 'Bundle not found.', 'NOT_FOUND');
    const [rows] = await pool.query('SELECT * FROM bundles WHERE public_id = ? LIMIT 1', [req.params.id]);
    const row = rows[0];
    if (!row) throw new HttpError(404, 'Bundle not found.', 'NOT_FOUND');
    if (!isOwnerOf(row, viewerOf(req))) throw new HttpError(403, 'You are not allowed to delete this bundle.', 'FORBIDDEN');
    const [files] = await pool.query('SELECT id, stored_name FROM files WHERE bundle_id = ?', [row.id]);
    for (const f of files) await removeStored(f.stored_name);
    await pool.query('DELETE FROM files WHERE bundle_id = ?', [row.id]);
    await pool.query('DELETE FROM bundles WHERE id = ?', [row.id]);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
