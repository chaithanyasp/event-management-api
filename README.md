# 🎯 Event Management API

A RESTful API built with **Node.js** and **Express.js** for managing events, user authentication, and participant registrations — all using **in-memory data structures** (no database required).

---

## 🚀 Features

- ✅ User Registration & Login with **bcrypt** password hashing
- ✅ **JWT** token-based authentication
- ✅ Role-based access control — `organizer` and `attendee`
- ✅ Full **CRUD** operations for events
- ✅ Participant registration & management
- ✅ Async **email notifications** via Nodemailer (Ethereal)
- ✅ In-memory data storage (arrays & objects)

---

## 🛠️ Tech Stack

| Package | Purpose |
|---|---|
| Express.js | Web framework |
| bcryptjs | Password hashing |
| jsonwebtoken | JWT authentication |
| nodemailer | Email notifications |
| uuid | Unique ID generation |
| cors | Cross-Origin Resource Sharing |
| helmet | Security headers |
| morgan | HTTP request logging |
| dotenv | Environment variables |

---

## 📁 Project Structure

```
event-management-api/
├── index.js                        # Entry point
├── .env                            # Environment variables
├── .gitignore
├── package.json
└── src/
    ├── controllers/
    │   ├── authController.js       # Register, Login, Logout, Profile
    │   ├── eventController.js      # Event CRUD + Registration
    │   └── userController.js       # User management
    ├── data/
    │   └── store.js                # In-memory data store
    ├── middleware/
    │   ├── auth.js                 # JWT verification & role guards
    │   └── validators.js           # Input validation
    ├── routes/
    │   ├── auth.js                 # /api/auth routes
    │   ├── events.js               # /api/events routes
    │   └── users.js                # /api/users routes
    └── services/
        └── emailService.js         # Nodemailer email notifications
```

---

## ⚙️ Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/event-management-api.git
cd event-management-api
```

### 2. Install dependencies
```bash
npm install
```

### 3. Create `.env` file in root
```dotenv
PORT=3000
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# Ethereal SMTP (for email testing)
EMAIL_HOST=smtp.ethereal.email
EMAIL_PORT=587
EMAIL_USER=your_ethereal_email
EMAIL_PASS=your_ethereal_password
EMAIL_FROM="Event Platform <your_ethereal_email>"
```

> 💡 Get free Ethereal credentials at [https://ethereal.email](https://ethereal.email)

### 4. Start the server
```bash
# Production
npm start

# Development (auto-restart)
npm run dev
```

Server runs at → `http://localhost:3000`

---

## 🔑 Seed Credentials

These users are available immediately on server start:

| Name | Email | Password | Role |
|---|---|---|---|
| Alice Johnson | alice@example.com | Password1! | organizer |
| Bob Smith | bob@example.com | Password2! | attendee |

---

## 📡 API Endpoints

### Auth Routes
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login & get token |
| POST | `/api/auth/logout` | 🔒 Any | Logout (blacklist token) |
| GET | `/api/auth/me` | 🔒 Any | Get own profile |
| PUT | `/api/auth/me` | 🔒 Any | Update own profile |
| PUT | `/api/auth/me/password` | 🔒 Any | Change password |

### Event Routes
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/events` | Public | List all events |
| GET | `/api/events/:id` | Public | Get event details |
| POST | `/api/events` | 🔒 Organizer | Create event |
| PUT | `/api/events/:id` | 🔒 Organizer | Update event |
| DELETE | `/api/events/:id` | 🔒 Organizer | Delete event |
| GET | `/api/events/:id/attendees` | 🔒 Organizer | View attendees |
| GET | `/api/events/organizer/my` | 🔒 Organizer | My events |
| POST | `/api/events/:id/register` | 🔒 Attendee | Register for event |
| DELETE | `/api/events/:id/register` | 🔒 Attendee | Cancel registration |

### User Routes
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/users` | 🔒 Any | List all users |
| GET | `/api/users/:id` | 🔒 Any | Get user by ID |
| GET | `/api/users/:id/events` | 🔒 Any | Events user attends |

---

## 📨 Sample Requests

### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password1!",
  "role": "organizer"
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "Password1!"
}
```

### Create Event
```http
POST /api/events
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "title": "Tech Conference 2025",
  "description": "Annual technology conference featuring industry leaders.",
  "date": "2025-06-15",
  "time": "09:00",
  "location": "San Francisco Convention Center",
  "capacity": 500,
  "category": "technology",
  "tags": ["AI", "cloud", "devops"]
}
```

### Register for Event
```http
POST /api/events/EVENT_ID/register
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 📧 Email Notifications

Three automatic emails are sent using async/await + Promises:

| Trigger | Email |
|---|---|
| User registers | 🎉 Welcome email |
| Attendee joins event | ✅ Registration confirmation |
| Organizer cancels event | ❌ Cancellation notice to all attendees |

> View sent emails at [https://ethereal.email/messages](https://ethereal.email/messages)

---

## 🗄️ In-Memory Data Store

No database is used. All data is stored in memory:

```js
const users         = [];  // All registered users
const events        = [];  // All events + attendee lists
const notifications = [];  // Email notification log
const tokenBlacklist = new Set(); // Revoked JWT tokens
```

> ⚠️ Data resets on every server restart — by design for this project.

---

## 🔐 Security Features

- Passwords hashed with **bcrypt** (12 rounds)
- **JWT** tokens expire in 24 hours
- Token **blacklisting** on logout
- **Helmet.js** security headers
- Role-based route protection
- Timing-safe login (prevents user enumeration)

---

## 📝 License

MIT
