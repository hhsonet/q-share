import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import {
  SESSION_COOKIE, SESSION_DAYS, clearSessionCookie, hashPassword, hashSession,
  newSessionToken, parseCookies, setSessionCookie, verifyPassword,
} from '../lib/auth.js';
import { pool } from '../lib/db.js';
import { HttpError } from '../lib/errors.js';

export const authRouter = Router();

authRouter.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.authMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
  }),
);

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(200),
});

function parseCredentials(body) {
  const r = credentials.safeParse(body);
  if (!r.success) {
    const pw = r.error.issues.find((i) => i.path[0] === 'password');
    throw new HttpError(400, pw ? pw.message : 'Enter a valid email address.', 'BAD_REQUEST');
  }
  return r.data;
}

async function startSession(res, userId) {
  const token = newSessionToken();
  const now = new Date();
  await pool.query('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [
    hashSession(token), userId, now, new Date(now.getTime() + SESSION_DAYS * 864e5),
  ]);
  setSessionCookie(res, token);
}

authRouter.get('/me', (req, res) => res.json({ user: req.user }));

authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password } = parseCredentials(req.body);
    const hash = await hashPassword(password);
    let id;
    try {
      const [r] = await pool.query('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', [email, hash, new Date()]);
      id = Number(r.insertId);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'An account with this email already exists.', 'EMAIL_TAKEN');
      throw e;
    }
    await startSession(res, id);
    res.status(201).json({ user: { id, email } });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = parseCredentials(req.body);
    const [rows] = await pool.query('SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1', [email]);
    const u = rows[0];
    // Same error and similar work for unknown email vs wrong password.
    const ok = u ? await verifyPassword(password, u.password_hash) : (await hashPassword(password), false);
    if (!ok) throw new HttpError(401, 'Incorrect email or password.', 'BAD_CREDENTIALS');
    await startSession(res, Number(u.id));
    res.json({ user: { id: Number(u.id), email: u.email } });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      await pool.query('DELETE FROM sessions WHERE token_hash = ?', [hashSession(token)]);
    }
    clearSessionCookie(res);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
