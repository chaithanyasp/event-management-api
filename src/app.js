require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const { seed } = require('./data/store');
const { errorHandler, notFound } = require('./Middelware/validator');

const eventRoutes = require("../routes/eventRoutes")
const authRoutes = require("../routes/authRoutes")
const userRoutes = require("../routes/userRoutes")

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Core Middleware ───────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', uptime: process.uptime().toFixed(2) + 's', timestamp: new Date().toISOString() }),
);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',authRoutes);
app.use('/api/events',eventRoutes);
app.use('/api/users', userRoutes);

// ─── API Index ────────────────────────────────────────────────────────────────
app.get('/api', (req, res) => res.json({
  name: 'Event Management API',
  version: '2.0.0',
  endpoints: {
    auth: {
      register:        'POST   /api/auth/register',
      login:           'POST   /api/auth/login',
      logout:          'POST   /api/auth/logout',
      profile:         'GET    /api/auth/me',
      updateProfile:   'PUT    /api/auth/me',
      changePassword:  'PUT    /api/auth/me/password',
    },
    events: {
      list:            'GET    /api/events               [?category,status,organizerId,search]',
      get:             'GET    /api/events/:id',
      create:          'POST   /api/events',
      update:          'PUT    /api/events/:id',
      delete:          'DELETE /api/events/:id',
      attendees:       'GET    /api/events/:id/attendees',
      myEvents:        'GET    /api/events/organizer/my',
      register:        'POST   /api/events/:id/register',
      unregister:      'DELETE /api/events/:id/register',
    },
    users: {
      list:            'GET    /api/users',
      get:             'GET    /api/users/:id',
      userEvents:      'GET    /api/users/:id/events',
    },
  },
}));


// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
const start = async () => {
  await seed();   // bcrypt-hash seed users before accepting requests
  app.listen(PORT, () => {
    console.log(`\n Event Management API v2  →  http://localhost:${PORT}`);
    console.log(`Endpoint index           →  http://localhost:${PORT}/api`);
    // console.log(` Health                  →  http://localhost:${PORT}/health`);
    console.log(`\n Seed credentials:`);
  
  });
};

start().catch((err) => { console.error('Startup error:', err); process.exit(1); });

module.exports = app;

