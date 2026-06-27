require('dotenv').config();
const bcrypt = require('bcryptjs');
const { store } = require('../data/store');
const { signToken } = require('../Middelware/auth');
const { sendWelcomeEmail } = require('../Services/emailServices');

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;

// ─── POST /register ───────────────────────────────────────────────────────────

const register = async (req, res, next) => {
  try {
    const { name, email, password, role = 'attendee', bio = '' } = req.body;

    if (store.getUserByEmail(email)) {
      return res.status(409).json({ success: false, error: 'Email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, ROUNDS);

    const user = store.addUser({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,           // 'organizer' | 'attendee'
      bio,
      avatar: null,
    });

    // Fire-and-forget welcome email (non-blocking async)
    sendWelcomeEmail(user).catch((err) =>
      console.error('[register] Welcome email error:', err.message),
    );

    const token = signToken(user);
    const { password: _, ...profile } = user;

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: profile,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /login ──────────────────────────────────────────────────────────────

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = store.getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      // Timing-safe: always run bcrypt even on miss
      await bcrypt.compare(password, '$2a$12$invalidhashpadding000000000000000000000000000000000000');
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const token = signToken(user);
    const { password: _, ...profile } = user;

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: profile,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /logout ─────────────────────────────────────────────────────────────

const logout = (req, res) => {
  // Blacklist the current token's jti so it can't be reused
  store.blacklistToken(req.tokenJti);
  res.json({ success: true, message: 'Logged out successfully.' });
};

// ─── GET /me ──────────────────────────────────────────────────────────────────

const getMe = (req, res) => {
  const { password, ...profile } = req.user;
  res.json({ success: true, data: profile });
};

// ─── PUT /me ──────────────────────────────────────────────────────────────────

const updateMe = async (req, res, next) => {
  try {
    const { name, bio, avatar } = req.body;
    const updates = {};
    if (name)   updates.name   = name.trim();
    if (bio !== undefined) updates.bio = bio;
    if (avatar !== undefined) updates.avatar = avatar;

    const updated = store.updateUser(req.user.id, updates);
    const { password, ...profile } = updated;
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /me/password ────────────────────────────────────────────────────────

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'currentPassword and newPassword are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters.' });
    }

    const match = await bcrypt.compare(currentPassword, req.user.password);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    const hashed = await bcrypt.hash(newPassword, ROUNDS);
    store.updatePassword(req.user.id, hashed);

    // Invalidate current token so user must re-login
    store.blacklistToken(req.tokenJti);

    res.json({ success: true, message: 'Password updated. Please log in again with your new password.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, logout, getMe, updateMe, changePassword };