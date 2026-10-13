import { hashToken } from '../lib/files.js';

const TOKEN_RE = /^[a-f0-9]{64}$/;

/** Reads the anonymous per-browser owner token. Sets req.ownerHash (or null). */
export function ownerMiddleware(req, _res, next) {
  const t = req.get('x-owner-token');
  req.ownerHash = t && TOKEN_RE.test(t) ? hashToken(t) : null;
  next();
}
