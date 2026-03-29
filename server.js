require('dotenv').config();
const express = require('express');
require('./config/db')();

// ... existing imports ...
const setupSecurityHeaders = require('./security/headers');
const setupSessionAndCsrf = require('./security/session');
const { apiLimiter } = require('./security/rateLimiter');
const { requireApiKey } = require('./security/apiKey');

const app = express();

// 1. Security Headers (Helmet)
setupSecurityHeaders(app);

// 2. Session & CSRF
setupSessionAndCsrf(app);

// 3. API Rate Limiting & Key Validation (Apply to all /api/ routes)
app.use('/api/', apiLimiter);
// app.use('/api/internal', requireApiKey); // Uncomment this to lock down internal APIs

// ... your routes (app.use('/', ...)) ...

const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

const adminApp = express();
const userApp = express();

adminApp.use(express.json());
adminApp.use(express.urlencoded({ extended: true }));
userApp.use(express.json());
userApp.use(express.urlencoded({ extended: true }));

adminApp.use('/admin', adminRoutes);
adminApp.use('/api/internal', adminRoutes);
userApp.use('/', userRoutes);

const ADMIN_PORT = process.env.ADMIN_PORT || 4000;
const USER_PORT = process.env.USER_PORT || 3000;
const VPS_IP = process.env.VPS_IP || '127.0.0.1';

adminApp.listen(ADMIN_PORT, () => console.log(`🚀 Admin Dashboard: http://${VPS_IP}:${ADMIN_PORT}/admin`));
userApp.listen(USER_PORT, () => console.log(`🚀 User Panel     : http://${VPS_IP}:${USER_PORT}/panel`));
