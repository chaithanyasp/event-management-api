const express = require('express');
const router = express.Router();
const { validateEvent } = require('../src/Middelware/validator');
const { authenticate, requireOrganizer, requireAttendee } = require('../src/Middelware/auth');
const {
  getAllEvents, getEventById, createEvent, updateEvent, deleteEvent,
  registerForEvent, unregisterFromEvent, getAttendees, getMyEvents,
} = require('../src/Controllers/eventController');

// Public
router.get('/',    getAllEvents);
router.get('/:id', getEventById);

// Organizer only
router.get('/organizer/my',        authenticate, requireOrganizer, getMyEvents);
router.post('/',                   authenticate, requireOrganizer, validateEvent, createEvent);
router.put('/:id',                 authenticate, requireOrganizer, updateEvent);
router.delete('/:id',              authenticate, requireOrganizer, deleteEvent);
router.get('/:id/attendees',       authenticate, requireOrganizer, getAttendees);

// Attendee only
router.post('/:id/register',       authenticate, requireAttendee, registerForEvent);
router.delete('/:id/register',     authenticate, requireAttendee, unregisterFromEvent);

module.exports = router;