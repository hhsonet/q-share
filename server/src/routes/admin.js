import { Router } from 'express';
import { z } from 'zod';
import { hashPassword } from '../lib/auth.js';
import { CATEGORIES, getAllowedCategories, setAllowedCategories } from '../lib/fileTypes.js';
import { getExpiryHours, setExpiryHours } from '../lib/settings.js';
import { pool } from '../lib/db.js';
import { HttpError } from '../lib/errors.js';
import { PUBLIC_ID_RE, getExtension } from '../lib/files.js';

export const adminRouter = Router();

// Everything under /api/admin is admin-only.
adminRouter.use((req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Sign in required.', 'UNAUTHORIZED'));
  if (!req.user.isAdmin) return next(new HttpError(403, 'Admins only.', 'FORBIDDEN'));
  next();
});

const escapeLike = (q) => `%${q.replace(/[\\%_]/g, '\\$&')}%`;
const iso = (d) => (d ? new Date(d).toISOString() : null);

adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const [[f]] = await pool.query(
      `SELECT COUNT(*) files, COALESCE(SUM(size), 0) bytes, COALESCE(SUM(is_public), 0) public_files,
              COALESCE(SUM(user_id IS NULL), 0) anonymous_files
       FROM files WHERE expires_at IS NULL OR expires_at > UTC_TIMESTAMP()`,
    );
    const [[u]] = await pool.query('SELECT COUNT(*) users, COALESCE(SUM(is_admin), 0) admins FROM users');
    res.json({
      users: Number(u.users),
      admins: Number(u.admins),
      files: Number(f.files),
      bytes: Number(f.bytes),
      publicFiles: Number(f.public_files),
      anonymousFiles: Number(f.anonymous_files),
    });
  } catch (e) {
    next(e);
  }
});

const usersQuery = z.object({ q: z.string().trim().max(100).optional().default('') });

adminRouter.get('/users', async (req, res, next) => {
  try {
    const { q } = usersQuery.parse(req.query);
    const like = escapeLike(q);
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.username, u.is_admin, u.created_at,
              COUNT(f.id) AS file_count, COALESCE(SUM(f.size), 0) AS bytes, MAX(f.created_at) AS last_upload
       FROM users u
       LEFT JOIN files f ON f.user_id = u.id AND (f.expires_at IS NULL OR f.expires_at > UTC_TIMESTAMP())
       WHERE (u.email LIKE ? ESCAPE '\\\\' OR u.username LIKE ? ESCAPE '\\\\')
       GROUP BY u.id
       ORDER BY u.created_at DESC, u.id DESC LIMIT 500`,
      [like, like],
    );
    res.json({
      users: rows.map((r) => ({
        id: Number(r.id),
        email: r.email,
        username: r.username,
        name: r.username || r.email,
        isAdmin: !!r.is_admin,
        createdAt: iso(r.created_at),
        fileCount: Number(r.file_count),
        bytes: Number(r.bytes),
        lastUpload: iso(r.last_upload),
      })),
    });
  } catch (e) {
    next(e);
  }
});

const filesQuery = z.object({
  q: z.string().trim().max(100).optional().default(''),
  sort: z.enum(['newest', 'oldest', 'name', 'size']).optional().default('newest'),
  // all | public | private | anonymous | user:<id>
  filter: z.string().regex(/^(all|public|private|anonymous|user:\d{1,12})$/).optional().default('all'),
});

const SORT_SQL = {
  newest: 'f.created_at DESC, f.id DESC',
  oldest: 'f.created_at ASC, f.id ASC',
  name: 'f.original_name ASC, f.id ASC',
  size: 'f.size DESC, f.id DESC',
};

adminRouter.get('/files', async (req, res, next) => {
  try {
    const { q, sort, filter } = filesQuery.parse(req.query);
    const where = ['(f.expires_at IS NULL OR f.expires_at > UTC_TIMESTAMP())', "f.original_name LIKE ? ESCAPE '\\\\'"];
    const params = [escapeLike(q)];
    if (filter === 'public') where.push('f.is_public = 1');
    else if (filter === 'private') where.push('f.is_public = 0');
    else if (filter === 'anonymous') where.push('f.user_id IS NULL');
    else if (filter.startsWith('user:')) {
      where.push('f.user_id = ?');
      params.push(Number(filter.slice(5)));
    }
    const [rows] = await pool.query(
      `SELECT f.public_id, f.original_name, f.mime_type, f.size, f.is_public, f.download_count,
              f.created_at, f.expires_at, f.user_id, u.email, u.username
       FROM files f LEFT JOIN users u ON u.id = f.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY ${SORT_SQL[sort]} LIMIT 500`,
      params,
    );
    res.json({
      files: rows.map((r) => ({
        kind: 'file',
        id: r.public_id,
        name: r.original_name,
        extension: getExtension(r.original_name),
        mimeType: r.mime_type,
        size: Number(r.size),
        isPublic: !!r.is_public,
        isOwner: true, // admins can delete any file
        downloadCount: r.download_count,
        createdAt: iso(r.created_at),
        expiresAt: iso(r.expires_at),
        uploader: r.user_id ? { id: Number(r.user_id), name: r.username || r.email } : null,
      })),
    });
  } catch (e) {
    next(e);
  }
});

const resetBody = z.object({ password: z.string().min(8, 'Password must be at least 8 characters.').max(200) });

// Set a new password for a user and sign them out everywhere.
adminRouter.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    if (!/^\d{1,12}$/.test(req.params.id)) throw new HttpError(404, 'User not found.', 'NOT_FOUND');
    const parsed = resetBody.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message, 'BAD_REQUEST');
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT id FROM users WHERE id = ? LIMIT 1', [id]);
    if (!rows[0]) throw new HttpError(404, 'User not found.', 'NOT_FOUND');
    const hash = await hashPassword(parsed.data.password);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
    await pool.query('DELETE FROM sessions WHERE user_id = ?', [id]);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// --- expiry ---
const MAX_DAYS = 3650;
const daysSchema = z.number().int().min(1, 'Enter at least 1 day.').max(MAX_DAYS, `Maximum is ${MAX_DAYS} days.`);
const defaultDays = z.number().int().min(0).max(MAX_DAYS);

adminRouter.get('/settings', async (_req, res, next) => {
  try {
    res.json({ expiryDays: Math.round((await getExpiryHours()) / 24) });
  } catch (e) {
    next(e);
  }
});

// Default expiry for NEW uploads, in days (0 = never expire).
adminRouter.put('/settings', async (req, res, next) => {
  try {
    const r = z.object({ expiryDays: defaultDays }).safeParse(req.body);
    if (!r.success) throw new HttpError(400, `Expiry must be 0 (never) to ${MAX_DAYS} days.`, 'BAD_REQUEST');
    await setExpiryHours(r.data.expiryDays * 24);
    res.json({ expiryDays: r.data.expiryDays });
  } catch (e) {
    next(e);
  }
});

// Apply an expiry to EVERY existing file: upload date + N days (0 = never expire).
adminRouter.post('/files/apply-expiry', async (req, res, next) => {
  try {
    const r = z.object({ days: defaultDays }).safeParse(req.body);
    if (!r.success) throw new HttpError(400, `Expiry must be 0 (never) to ${MAX_DAYS} days.`, 'BAD_REQUEST');
    const [result] = r.data.days
      ? await pool.query('UPDATE files SET expires_at = DATE_ADD(created_at, INTERVAL ? DAY)', [r.data.days])
      : await pool.query('UPDATE files SET expires_at = NULL');
    res.json({ updated: result.affectedRows });
  } catch (e) {
    next(e);
  }
});

// One file: expire N days from now, or never (days = null).
adminRouter.patch('/files/:id/expiry', async (req, res, next) => {
  try {
    if (!PUBLIC_ID_RE.test(req.params.id)) throw new HttpError(404, 'File not found.', 'NOT_FOUND');
    const r = z.object({ days: daysSchema.nullable() }).safeParse(req.body);
    if (!r.success) throw new HttpError(400, r.error.issues[0].message, 'BAD_REQUEST');
    const expires = r.data.days === null ? null : new Date(Date.now() + r.data.days * 864e5);
    const [result] = await pool.query('UPDATE files SET expires_at = ? WHERE public_id = ?', [expires, req.params.id]);
    if (!result.affectedRows) throw new HttpError(404, 'File not found.', 'NOT_FOUND');
    res.json({ expiresAt: expires ? expires.toISOString() : null });
  } catch (e) {
    next(e);
  }
});

// Make any file public (listed for everyone) or private (link only).
adminRouter.patch('/files/:id/visibility', async (req, res, next) => {
  try {
    if (!PUBLIC_ID_RE.test(req.params.id)) throw new HttpError(404, 'File not found.', 'NOT_FOUND');
    const r = z.object({ isPublic: z.boolean() }).safeParse(req.body);
    if (!r.success) throw new HttpError(400, 'Invalid request.', 'BAD_REQUEST');
    const [result] = await pool.query('UPDATE files SET is_public = ? WHERE public_id = ?', [r.data.isPublic ? 1 : 0, req.params.id]);
    if (!result.affectedRows) throw new HttpError(404, 'File not found.', 'NOT_FOUND');
    res.json({ isPublic: r.data.isPublic });
  } catch (e) {
    next(e);
  }
});

// --- allowed file types ---
adminRouter.get('/allowed-types', async (_req, res, next) => {
  try {
    res.json({ categories: CATEGORIES, enabled: await getAllowedCategories() });
  } catch (e) {
    next(e);
  }
});

// Which file-type groups visitors may upload (existing files are not affected).
adminRouter.put('/allowed-types', async (req, res, next) => {
  try {
    const keys = CATEGORIES.map((c) => c.key);
    const r = z.object({ enabled: z.array(z.enum(keys)).max(keys.length) }).safeParse(req.body);
    if (!r.success) throw new HttpError(400, 'Invalid file type selection.', 'BAD_REQUEST');
    if (!r.data.enabled.length) throw new HttpError(400, 'Allow at least one file type.', 'BAD_REQUEST');
    res.json({ enabled: await setAllowedCategories(r.data.enabled) });
  } catch (e) {
    next(e);
  }
});
