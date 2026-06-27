// ─── Validation Middleware ─────────────────────────────────────────────────────

const validateRegister = (req, res, next) => {
  const { name, email, password, role } = req.body;
  const errors = [];

  if (!name || name.trim().length < 2)
    errors.push('Name must be at least 2 characters.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push('A valid email address is required.');
  if (!password || password.length < 8)
    errors.push('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(password))
    errors.push('Password must contain at least one uppercase letter.');
  if (!/[0-9]/.test(password))
    errors.push('Password must contain at least one digit.');
  if (role && !['organizer', 'attendee'].includes(role))
    errors.push("Role must be 'organizer' or 'attendee'.");

  if (errors.length) return res.status(400).json({ success: false, errors });
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];
  if (!email) errors.push('Email is required.');
  if (!password) errors.push('Password is required.');
  if (errors.length) return res.status(400).json({ success: false, errors });
  next();
};

const VALID_CATEGORIES = ['technology', 'arts', 'sports', 'business', 'health', 'education', 'other'];
const VALID_STATUSES   = ['upcoming', 'ongoing', 'completed', 'cancelled'];

const validateEvent = (req, res, next) => {
  const { title, description, date, time, location, capacity, category } = req.body;
  const errors = [];

  if (!title || title.trim().length < 3)
    errors.push('Title must be at least 3 characters.');
  if (!description || description.trim().length < 10)
    errors.push('Description must be at least 10 characters.');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    errors.push('Date must be in YYYY-MM-DD format.');
  if (!time || !/^\d{2}:\d{2}$/.test(time))
    errors.push('Time must be in HH:MM format.');
  if (!location || location.trim().length < 3)
    errors.push('Location is required.');
  if (!capacity || !Number.isInteger(Number(capacity)) || Number(capacity) < 1)
    errors.push('Capacity must be a positive integer.');
  if (!category || !VALID_CATEGORIES.includes(category))
    errors.push(`Category must be one of: ${VALID_CATEGORIES.join(', ')}.`);

  if (errors.length) return res.status(400).json({ success: false, errors });
  next();
};

// ─── Error Handlers ───────────────────────────────────────────────────────────

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal Server Error' });
};

const notFound = (req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.originalUrl}` });
};

module.exports = { validateRegister, validateLogin, validateEvent, errorHandler, notFound, VALID_CATEGORIES, VALID_STATUSES };