require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// ─── In-Memory Collections ─────────────────────────────────────────────────────
//
//  users[]        – all registered accounts
//  events[]       – all events
//  notifications[] – async email notification log (no real DB needed)
//  tokenBlacklist  – revoked JWT jti values (logout support)
//
// ──────────────────────────────────────────────────────────────────────────────

const users = [];
const events = [];
const notifications = [];   // { id, type, recipientId, payload, sentAt, status }
const tokenBlacklist = new Set();

// ─── Seed Data (created async so bcrypt can hash properly) ────────────────────

let seeded = false;

const seed = async () => {
  if (seeded) return;
  seeded = true;

  const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;

  const aliceId = uuidv4();
  const bobId   = uuidv4();

  users.push({
    id: aliceId,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    password: await bcrypt.hash('Password1!', rounds),
    role: 'organizer',            // can create / manage events
    bio: 'Veteran tech-event organizer.',
    avatar: null,
    createdAt: new Date('2024-01-15').toISOString(),
  });

  users.push({
    id: bobId,
    name: 'Bob Smith',
    email: 'bob@example.com',
    password: await bcrypt.hash('Password2!', rounds),
    role: 'attendee',             // can register for events
    bio: 'Avid conference-goer.',
    avatar: null,
    createdAt: new Date('2024-02-20').toISOString(),
  });

  const e1Id = uuidv4();
  const e2Id = uuidv4();

  events.push({
    id: e1Id,
    title: 'Tech Conference 2025',
    description: 'Annual technology conference featuring industry leaders and cutting-edge demos.',
    date: '2025-06-15',
    time: '09:00',
    endDate: '2025-06-15',
    endTime: '18:00',
    location: 'San Francisco Convention Center',
    capacity: 500,
    category: 'technology',
    tags: ['AI', 'cloud', 'devops'],
    organizerId: aliceId,
    attendees: [
      { userId: bobId, registeredAt: new Date().toISOString() },
    ],
    status: 'upcoming',   // upcoming | ongoing | completed | cancelled
    createdAt: new Date().toISOString(),
  });

  events.push({
    id: e2Id,
    title: 'Art & Culture Festival',
    description: 'A celebration of local art, music, and culture across three open-air stages.',
    date: '2025-07-20',
    time: '10:00',
    endDate: '2025-07-20',
    endTime: '22:00',
    location: 'Downtown Park',
    capacity: 1000,
    category: 'arts',
    tags: ['music', 'painting', 'local'],
    organizerId: aliceId,
    attendees: [],
    status: 'upcoming',
    createdAt: new Date().toISOString(),
  });
};

// ─── Store API ─────────────────────────────────────────────────────────────────

const store = {
  // ── Auth helpers ────────────────────────────────────────────────────────────
  blacklistToken: (jti) => tokenBlacklist.add(jti),
  isTokenBlacklisted: (jti) => tokenBlacklist.has(jti),

  // ── Users ───────────────────────────────────────────────────────────────────
  getUsers: () => users,
  getUserById:    (id)    => users.find((u) => u.id === id)       || null,
  getUserByEmail: (email) => users.find((u) => u.email === email) || null,

  addUser: (data) => {
    const user = { id: uuidv4(), createdAt: new Date().toISOString(), ...data };
    users.push(user);
    return user;
  },

  updateUser: (id, updates) => {
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    // prevent overwriting immutable fields
    const { id: _id, createdAt, password, ...safe } = updates;
    users[idx] = { ...users[idx], ...safe, updatedAt: new Date().toISOString() };
    return users[idx];
  },

  updatePassword: (id, hashedPassword) => {
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx].password = hashedPassword;
    users[idx].updatedAt = new Date().toISOString();
    return users[idx];
  },

  deleteUser: (id) => {
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    users.splice(idx, 1);
    return true;
  },

  // ── Events ──────────────────────────────────────────────────────────────────
  getEvents: (filters = {}) => {
    let result = [...events];
    if (filters.category)   result = result.filter((e) => e.category   === filters.category);
    if (filters.status)     result = result.filter((e) => e.status     === filters.status);
    if (filters.organizerId)result = result.filter((e) => e.organizerId=== filters.organizerId);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (e) => e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q),
      );
    }
    return result;
  },

  getEventById: (id) => events.find((e) => e.id === id) || null,

  addEvent: (data) => {
    const event = {
      id: uuidv4(),
      attendees: [],
      status: 'upcoming',
      tags: [],
      createdAt: new Date().toISOString(),
      ...data,
    };
    events.push(event);
    return event;
  },

  updateEvent: (id, updates) => {
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const { id: _id, organizerId, attendees, createdAt, ...safe } = updates;
    events[idx] = { ...events[idx], ...safe, updatedAt: new Date().toISOString() };
    return events[idx];
  },

  deleteEvent: (id) => {
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    events.splice(idx, 1);
    return true;
  },

  // ── Attendee management ──────────────────────────────────────────────────────
  isRegistered: (eventId, userId) => {
    const event = events.find((e) => e.id === eventId);
    return event ? event.attendees.some((a) => a.userId === userId) : false;
  },

  addAttendee: (eventId, userId) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return { error: 'Event not found', status: 404 };
    if (event.status === 'cancelled')  return { error: 'Event is cancelled', status: 400 };
    if (event.status === 'completed')  return { error: 'Event has already ended', status: 400 };
    if (event.attendees.some((a) => a.userId === userId))
      return { error: 'Already registered for this event', status: 409 };
    if (event.attendees.length >= event.capacity)
      return { error: 'Event has reached full capacity', status: 400 };
    event.attendees.push({ userId, registeredAt: new Date().toISOString() });
    return { event };
  },

  removeAttendee: (eventId, userId) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return null;
    event.attendees = event.attendees.filter((a) => a.userId !== userId);
    return event;
  },

  // ── Notifications log ────────────────────────────────────────────────────────
  logNotification: (entry) => {
    const record = { id: uuidv4(), createdAt: new Date().toISOString(), ...entry };
    notifications.push(record);
    return record;
  },
  getNotifications: () => notifications,
};

module.exports = { store, seed };