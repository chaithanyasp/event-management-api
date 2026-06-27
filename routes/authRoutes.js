const express = require('express');
const router = express.Router();
const { validateRegister, validateLogin } = require('../src/Middelware/validator');
const { authenticate } = require('../src/Middelware/auth');
const { register, login, logout, getMe, updateMe, changePassword } = require('../src/Controllers/authController');

// Public
router.post('/register', validateRegister, register);
router.post('/login',    validateLogin,    login);

// Protected
router.post('/logout',         authenticate, logout);
router.get('/me',              authenticate, getMe);
router.put('/me',              authenticate, updateMe);
router.put('/me/password',     authenticate, changePassword);

module.exports = router;