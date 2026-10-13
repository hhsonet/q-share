import { hashSession, parseCookies, SESSION_COOKIE } from '../lib/auth.js';
import { toUser } from '../lib/auth.js';
import { pool } from '../lib/db.js';

/** Resolves the session cookie to req.user ({ id, email }) or null. */
export async function identityMiddleware(req, _res, next) {
  req.user = null;
  try {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const [rows] = await pool.query(
        `SELECT u.id, u.email, u.username, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP() LIMIT 1`,
        [hashSession(token)],
      );
      if (rows[0]) req.user = toUser(rows[0]);
    }
    next();
  } catch (e) {
    next(e);
  }
}
