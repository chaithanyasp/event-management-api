const { store } = require('../data/store');
const { sendRegistrationConfirmation, sendEventCancellationNotice } = require('../services/emailServices');

// ─── GET /events ──────────────────────────────────────────────────────────────

const getAllEvents = (req, res) => {
  const { category, status, organizerId, search } = req.query;
  const events = store.getEvents({ category, status, organizerId, search });

  // Enrich with organizer name and attendee count
  const data = events.map((e) => {
    const organizer = store.getUserById(e.organizerId);
    return {
      ...e,
      organizerName: organizer?.name || 'Unknown',
      attendeeCount: e.attendees.length,
      spotsLeft: e.capacity - e.attendees.length,
    };
  });

  res.json({ success: true, count: data.length, data });
};

// ─── GET /events/:id ──────────────────────────────────────────────────────────

const getEventById = (req, res) => {
  const event = store.getEventById(req.params.id);
  if (!event) return res.status(404).json({ success: false, error: 'Event not found.' });

  const organizer = store.getUserById(event.organizerId);
  res.json({
    success: true,
    data: {
      ...event,
      organizerName: organizer?.name || 'Unknown',
      attendeeCount: event.attendees.length,
      spotsLeft: event.capacity - event.attendees.length,
    },
  });
};

// ─── POST /events  (organizer only) ──────────────────────────────────────────

const createEvent = async (req, res, next) => {
  try {
    const { title, description, date, time, endDate, endTime, location, capacity, category, tags } = req.body;

    const event = store.addEvent({
      title: title.trim(),
      description: description.trim(),
      date,
      time,
      endDate: endDate || date,
      endTime: endTime || time,
      location: location.trim(),
      capacity: Number(capacity),
      category,
      tags: Array.isArray(tags) ? tags : [],
      organizerId: req.user.id,
    });

    res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /events/:id  (organizer only, must own event) ───────────────────────

const updateEvent = async (req, res, next) => {
  try {
    const event = store.getEventById(req.params.id);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found.' });

    if (event.organizerId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You can only edit your own events.' });
    }

    const { title, description, date, time, endDate, endTime, location, capacity, category, tags, status } = req.body;
    const updates = {};
    if (title)       updates.title       = title.trim();
    if (description) updates.description = description.trim();
    if (date)        updates.date        = date;
    if (time)        updates.time        = time;
    if (endDate)     updates.endDate     = endDate;
    if (endTime)     updates.endTime     = endTime;
    if (location)    updates.location    = location.trim();
    if (capacity)    updates.capacity    = Number(capacity);
    if (category)    updates.category    = category;
    if (tags)        updates.tags        = Array.isArray(tags) ? tags : [];
    if (status)      updates.status      = status;

    // If cancelling — asynchronously notify all attendees (non-blocking)
    if (status === 'cancelled' && event.status !== 'cancelled') {
      const attendeeUsers = event.attendees
        .map((a) => store.getUserById(a.userId))
        .filter(Boolean);

      if (attendeeUsers.length > 0) {
        sendEventCancellationNotice(attendeeUsers, event).catch((err) =>
          console.error('[updateEvent] Cancellation notices error:', err.message),
        );
      }
    }

    const updated = store.updateEvent(req.params.id, updates);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /events/:id  (organizer only, must own event) ────────────────────

const deleteEvent = async (req, res, next) => {
  try {
    const event = store.getEventById(req.params.id);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found.' });

    if (event.organizerId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You can only delete your own events.' });
    }

    store.deleteEvent(req.params.id);
    res.json({ success: true, message: 'Event deleted.' });
  } catch (err) {
    next(err);
  }
};

// ─── POST /events/:id/register  (attendee only) ───────────────────────────────

const registerForEvent = async (req, res, next) => {
  try {
    const result = store.addAttendee(req.params.id, req.user.id);

    if (result.error) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }

    // Non-blocking confirmation email
    sendRegistrationConfirmation(req.user, result.event).catch((err) =>
      console.error('[registerForEvent] Confirmation email error:', err.message),
    );

    res.json({
      success: true,
      message: `Successfully registered for "${result.event.title}". A confirmation email is on its way!`,
      data: {
        eventId: result.event.id,
        title: result.event.title,
        date: result.event.date,
        time: result.event.time,
        location: result.event.location,
        spotsLeft: result.event.capacity - result.event.attendees.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /events/:id/register  (attendee cancels own spot) ────────────────

const unregisterFromEvent = async (req, res, next) => {
  try {
    if (!store.isRegistered(req.params.id, req.user.id)) {
      return res.status(400).json({ success: false, error: 'You are not registered for this event.' });
    }

    const event = store.removeAttendee(req.params.id, req.user.id);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found.' });

    res.json({ success: true, message: 'Registration cancelled successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /events/:id/attendees  (organizer only) ─────────────────────────────

const getAttendees = (req, res) => {
  const event = store.getEventById(req.params.id);
  if (!event) return res.status(404).json({ success: false, error: 'Event not found.' });

  if (event.organizerId !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Only the event organizer can view the attendee list.' });
  }

  const attendees = event.attendees.map((a) => {
    const user = store.getUserById(a.userId);
    if (!user) return null;
    const { password, ...profile } = user;
    return { ...profile, registeredAt: a.registeredAt };
  }).filter(Boolean);

  res.json({ success: true, count: attendees.length, data: attendees });
};

// ─── GET /events/my  (organizer sees their events) ────────────────────────────

const getMyEvents = (req, res) => {
  const events = store.getEvents({ organizerId: req.user.id });
  res.json({ success: true, count: events.length, data: events });
};

module.exports = {
  getAllEvents, getEventById, createEvent, updateEvent, deleteEvent,
  registerForEvent, unregisterFromEvent, getAttendees, getMyEvents,
};