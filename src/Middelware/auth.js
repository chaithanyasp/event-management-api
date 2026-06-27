require('dotenv').config();
const jwt = require('jsonwebtoken');
const { store } = require('../data/store');

const SECRET = process.env.JWT_SECRET || 'changeme';

// ─── Token Utilities ──────────────────────────────────────────────────────────

/**
 * Sign a JWT for a given user.
 * Stores jti (JWT ID) so individual tokens can be blacklisted on logout.
 */
const signToken = (user) => {
  const jti = require('crypto').randomUUID();
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, jti },
    SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
  );
};

const verifyToken = (token) => jwt.verify(token, SECRET); // throws on invalid

// ─── authenticate — validates Bearer token, attaches req.user ─────────────────

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided.' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);

    // Check blacklist (logout support)
    if (store.isTokenBlacklisted(payload.jti)) {
      return res.status(401).json({ success: false, error: 'Token has been revoked. Please log in again.' });
    }

    // Attach full user object (fresh from store so updates are reflected)
    const user = store.getUserById(payload.sub);
    if (!user) return res.status(401).json({ success: false, error: 'User no longer exists.' });

    req.user    = user;
    req.tokenJti = payload.jti;
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired.' : 'Invalid token.';
    return res.status(401).json({ success: false, error: msg });
  }
};

// ─── Role Guards ──────────────────────────────────────────────────────────────

/** Only organizers may proceed. */
const requireOrganizer = (req, res, next) => {
  if (req.user?.role !== 'organizer') {
    return res.status(403).json({ success: false, error: 'Organizers only.' });
  }
  next();
};

/** Only attendees may proceed. */
const requireAttendee = (req, res, next) => {
  if (req.user?.role !== 'attendee') {
    return res.status(403).json({ success: false, error: 'Attendees only.' });
  }
  next();
};

/** Any authenticated user; role is up to the controller. */
const requireAny = authenticate; // alias for clarity in routes

module.exports = { signToken, verifyToken, authenticate, requireOrganizer, requireAttendee, requireAny };