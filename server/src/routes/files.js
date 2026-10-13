import fs from 'node:fs/promises';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config.js';
import { pool } from '../lib/db.js';
import { getExpiryHours } from '../lib/settings.js';
import { HttpError } from '../lib/errors.js';
import {
  PUBLIC_ID_RE,
  checkContent,
  checkExtension,
  mimeFor,
  moveIntoStorage,
  newPublicId,
  isOwnerOf,
  newStoredName,
  removeStored,
  sanitizeOriginalName,
  storagePath,
  tmpDir,
  toDto,
} from '../lib/files.js';

export const filesRouter = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpDir()),
    filename: (_req, _file, cb) => cb(null, newStoredName()),
  }),
  limits: { fileSize: config.maxFileSize, files: config.maxFilesPerRequest, fields: 2 },
  fileFilter: (_req, file, cb) => {
    const problem = checkExtension(sanitizeOriginalName(file.originalname));
    cb(problem ? new HttpError(415, problem, 'TYPE_NOT_ALLOWED') : null, !problem);
  },
});

const discard = (files) => Promise.all((files || []).map((f) => fs.unlink(f.path).catch(() => {})));

const listQuery = z.object({
  q: z.string().trim().max(100).optional().default(''),
  sort: z.enum(['newest', 'oldest', 'name', 'size']).optional().default('newest'),
  scope: z.enum(['mine', 'public', 'all']).optional().default('mine'),
});

const SORT_SQL = {
  newest: 'created_at DESC, id DESC',
  oldest: 'created_at ASC, id ASC',
  name: 'original_name ASC, id ASC',
  size: 'size DESC, id DESC',
};

function requireOwner(req) {
  if (!req.ownerHash) throw new HttpError(401, 'Missing or invalid owner token.', 'UNAUTHORIZED');
}

async function findFile(publicId) {
  if (!PUBLIC_ID_RE.test(publicId)) throw new HttpError(404, 'File not found.', 'NOT_FOUND');
  const [rows] = await pool.query('SELECT * FROM files WHERE public_id = ? LIMIT 1', [publicId]);
  const row = rows[0];
  if (!row) throw new HttpError(404, 'File not found.', 'NOT_FOUND');
  if (row.expires_at && new Date(row.expires_at) <= new Date()) {
    throw new HttpError(410, 'This link has expired.', 'EXPIRED');
  }
  return row;
}

// Upload one or more files (multipart field "files").
filesRouter.post('/', (req, res, next) => {
  requireOwner(req);
  upload.array('files', config.maxFilesPerRequest)(req, res, async (err) => {
    try {
      if (err) {
        await discard(req.files);
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            throw new HttpError(413, `File is too large. Maximum size is ${config.maxFileSize / 1024 / 1024} MB.`, 'TOO_LARGE');
          }
          throw new HttpError(400, 'Invalid upload request.', 'BAD_UPLOAD');
        }
        throw err;
      }
      const files = req.files || [];
      if (!files.length) throw new HttpError(400, 'No file received.', 'NO_FILE');

      // Anonymous uploads are always public; signed-in users choose (default private).
      const isPublic = req.user ? req.body?.public === '1' : true;
      const userId = req.user ? req.user.id : null;
      const viewer = { ownerHash: req.ownerHash, user: req.user };

      const expiryHours = await getExpiryHours();
      const created = [];
      const placed = [];
      try {
        for (const f of files) {
          const name = sanitizeOriginalName(f.originalname);
          const bad = checkExtension(name) || (await checkContent(f.path));
          if (bad) throw new HttpError(415, bad, 'TYPE_NOT_ALLOWED');
          if (f.size === 0) throw new HttpError(400, 'Empty files are not allowed.', 'EMPTY');

          const storedName = newStoredName();
          const publicId = newPublicId();
          const now = new Date();
          const expires = expiryHours ? new Date(now.getTime() + expiryHours * 3600_000) : null;

          await moveIntoStorage(f.path, storedName);
          placed.push(storedName);
          await pool.query(
            `INSERT INTO files (public_id, original_name, stored_name, mime_type, size, owner_hash, is_public, user_id, created_at, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [publicId, name, storedName, mimeFor(name), f.size, req.ownerHash, isPublic ? 1 : 0, userId, now, expires],
          );
          created.push({
            public_id: publicId, original_name: name, mime_type: mimeFor(name), size: f.size,
            owner_hash: req.ownerHash, is_public: isPublic ? 1 : 0, user_id: userId, created_at: now, expires_at: expires, download_count: 0,
          });
        }
      } catch (e) {
        // Roll back this request entirely.
        await discard(files);
        await Promise.all(placed.map((s) => removeStored(s).catch(() => {})));
        if (created.length) {
          await pool.query('DELETE FROM files WHERE public_id IN (?)', [created.map((c) => c.public_id)]);
        }
        throw e;
      }
      res.status(201).json({ files: created.map((c) => toDto(c, viewer)) });
    } catch (e) {
      next(e);
    }
  });
});

// List files: scope=mine (default, the caller's own) or scope=public (everyone's public files).
filesRouter.get('/', async (req, res, next) => {
  try {
    const { q, sort, scope } = listQuery.parse(req.query);
    let where;
    let params;
    if (scope === 'all') {
      if (!req.user?.isAdmin) throw new HttpError(403, 'Admins only.', 'FORBIDDEN');
      where = '1 = 1';
      params = [];
    } else if (scope === 'public') {
      where = 'is_public = 1';
      params = [];
    } else if (req.user) {
      where = 'user_id = ?';
      params = [req.user.id];
    } else {
      requireOwner(req);
      where = 'user_id IS NULL AND owner_hash = ?';
      params = [req.ownerHash];
    }
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const [rows] = await pool.query(
      `SELECT * FROM files
       WHERE ${where} AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())
         AND original_name LIKE ? ESCAPE '\\\\'
       ORDER BY ${SORT_SQL[sort]} LIMIT 500`,
      [...params, like],
    );
    const viewer = { ownerHash: req.ownerHash, user: req.user };
    res.json({ files: rows.map((r) => toDto(r, viewer)) });
  } catch (e) {
    next(e);
  }
});

// File metadata (anyone with the unguessable ID).
filesRouter.get('/:id', async (req, res, next) => {
  try {
    const row = await findFile(req.params.id);
    res.json({ file: toDto(row, { ownerHash: req.ownerHash, user: req.user }) });
  } catch (e) {
    next(e);
  }
});

// Download (anyone with the unguessable ID).
filesRouter.get('/:id/download', async (req, res, next) => {
  try {
    const row = await findFile(req.params.id);
    const abs = storagePath(row.stored_name);
    try {
      await fs.access(abs);
    } catch {
      throw new HttpError(404, 'File is no longer available.', 'MISSING');
    }
    pool.query('UPDATE files SET download_count = download_count + 1 WHERE id = ?', [row.id]).catch(() => {});
    res.attachment(row.original_name);
    res.setHeader('Content-Type', row.mime_type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    res.sendFile(abs, { dotfiles: 'allow', headers: {} }, (err) => {
      if (err && !res.headersSent) next(new HttpError(500, 'Could not read file.', 'READ_FAILED'));
    });
  } catch (e) {
    next(e);
  }
});

// Delete (owner only).
filesRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) requireOwner(req);
    if (!PUBLIC_ID_RE.test(req.params.id)) throw new HttpError(404, 'File not found.', 'NOT_FOUND');
    const [rows] = await pool.query('SELECT * FROM files WHERE public_id = ? LIMIT 1', [req.params.id]);
    const row = rows[0];
    if (!row) throw new HttpError(404, 'File not found.', 'NOT_FOUND');
    if (!isOwnerOf(row, { ownerHash: req.ownerHash, user: req.user })) throw new HttpError(403, 'You are not allowed to delete this file.', 'FORBIDDEN');
    await removeStored(row.stored_name);
    await pool.query('DELETE FROM files WHERE id = ?', [row.id]);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
