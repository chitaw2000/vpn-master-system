const session = require('express-session');
// 🌟 ဤနေရာတွင် Version အသစ်အတွက် Import ပုံစံ ပြောင်းလိုက်ပါသည် 🌟
const { RedisStore } = require('connect-redis'); 
const csrf = require('csurf');
const redisClient = require('../config/redis');

module.exports = function setupSessionAndCsrf(app) {
    // 1. Session Hardening
    app.use(session({
        store: new RedisStore({ client: redisClient }),
        secret: process.env.SESSION_SECRET || 'super-secure-fallback-secret-key-123!@#',
        resave: false,
        saveUninitialized: false,
        name: 'qito_session_id', // Change default 'connect.sid' name
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: 'lax',
            maxAge: 30 * 60 * 1000 // 30 minutes idle timeout
        }
    }));

    // 2. Strict Origin/Referer Check Middleware for POST/PUT/DELETE
    app.use((req, res, next) => {
        if (req.method !== 'GET' && !req.path.startsWith('/api/')) { 
            const origin = req.headers.origin;
            const host = req.headers.host;
            if (origin && !origin.includes(host)) {
                return res.status(403).json({ error: "Cross-Origin Request Blocked" });
            }
        }
        next();
    });

    // 3. CSRF Protection (Except for API routes which use x-api-key)
    const csrfProtection = csrf({ cookie: false }); 
    app.use((req, res, next) => {
        if (req.path.startsWith('/api/')) {
            next(); // Skip CSRF for API
        } else {
            csrfProtection(req, res, next);
        }
    });
};
