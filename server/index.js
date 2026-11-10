
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { UAParser } from 'ua-parser-js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 4000);

app.set(
  'trust proxy',
  isProduction
    // Render (and Vercel when proxying requests to Render) sit in front of
    // Express in production. Trust the single hosting proxy by default so
    // secure session cookies and req.ip use the forwarded client request.
    // Set TRUST_PROXY=0 only for a production deployment without a proxy.
    ? (process.env.TRUST_PROXY === '0' ? false : 1)
    : 'loopback'
);

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

// Allow the local frontend and the deployed Vercel frontend.
const allowedOrigins = new Set([
  'http://localhost:5173',
  ...(process.env.FRONTEND_URL || '')
    .split(',')
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(Boolean)
]);

app.use(cors({
  origin(origin, callback) {
    const normalizedOrigin = origin?.replace(/\/$/, '');

    if (!origin || allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(
      new Error(`CORS blocked origin: ${origin}`)
    );
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

app.use(session({
  name: 'instaclone.sid',
  secret: process.env.SESSION_SECRET || 'local-dev-only-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use('/uploads', express.static(uploadDir));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    cb(
      null,
      `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`
    );
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    cb(
      null,
      ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)
    );
  }
});

const publicUser = u => ({
  id: u.id,
  username: u.username,
  email: u.email,
  bio: u.bio,
  avatar: u.avatar,
  role: u.role,
  status: u.status,
  createdAt: u.created_at
});

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      error: 'Please sign in first.'
    });
  }

  const user = db.prepare(
    'SELECT * FROM users WHERE id=?'
  ).get(req.session.userId);

  if (!user || user.status !== 'active') {
    req.session.destroy(() => {});
    return res.status(401).json({
      error: 'Account unavailable.'
    });
  }

  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      error: 'Administrator access required.'
    });
  }

  next();
}

function deviceDetails(ua) {
  const p = new UAParser(ua).getResult();

  const device =
    p.device.type === 'mobile' ? 'Mobile' :
    p.device.type === 'tablet' ? 'Tablet' :
    'Desktop';

  return {
    device,
    browser: [p.browser.name, p.browser.version]
      .filter(Boolean).join(' ') || 'Unknown',
    os: [p.os.name, p.os.version]
      .filter(Boolean).join(' ') || 'Unknown'
  };
}

function clientIp(req) {
  // Render's edge forwards the visitor address in X-Forwarded-For. When
  // Vercel and Render both proxy the request, req.ip can stop at a private
  // intermediate address, so prefer the leftmost public forwarded address.
  const forwarded = String(req.get('x-forwarded-for') || '')
    .split(',')
    .map(value => value.trim().replace(/^::ffff:/, ''))
    .find(isPublicIp);

  if (forwarded) return forwarded;

  return String(
    req.ip || req.socket?.remoteAddress || ''
  ).replace(/^::ffff:/, '');
}

function isPublicIp(ip) {
  if (!ip) return false;

  const value = String(ip).toLowerCase().replace(/^::ffff:/, '');

  if (
    value === '::1' ||
    value === 'localhost' ||
    value.endsWith('.local')
  ) return false;

  const parts = value.split('.').map(Number);

  if (
    parts.length === 4 &&
    parts.every(n => Number.isInteger(n) && n >= 0 && n <= 255)
  ) {
    const [a, b] = parts;

    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0) return false;

    return true;
  }

  if (value.includes(':')) {
    if (
      value.startsWith('fe80:') ||
      value.startsWith('fc') ||
      value.startsWith('fd') ||
      value.startsWith('2001:db8:')
    ) return false;

    return true;
  }

  return false;
}

async function fetchNetworkInfo(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success) return null;

    return {
      ip_address: String(data.ip || '').slice(0, 64) || null,
      isp: String(data.connection?.isp || '').slice(0, 120) || null,
      city: String(data.city || '').slice(0, 80) || null,
      region: String(data.region || '').slice(0, 80) || null,
      country: String(data.country || '').slice(0, 80) || null,
      latitude: data.latitude != null && Number.isFinite(Number(data.latitude))
        ? Number(data.latitude) : null,
      longitude: data.longitude != null && Number.isFinite(Number(data.longitude))
        ? Number(data.longitude) : null
    };
  } catch {
    return null;
  }
}

function vercelGeoInfo(req) {
  const readHeader = (name, maxLength) => {
    const raw = String(req.get(name) || '').trim();
    if (!raw) return null;

    try {
      return decodeURIComponent(raw.replace(/\+/g, '%20')).slice(0, maxLength);
    } catch {
      return raw.slice(0, maxLength);
    }
  };

  const latitude = Number(req.get('x-vercel-ip-latitude'));
  const longitude = Number(req.get('x-vercel-ip-longitude'));
  const hasCoordinates = Number.isFinite(latitude) &&
    Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180;
  const city = readHeader('x-vercel-ip-city', 80);
  const region = readHeader('x-vercel-ip-country-region', 80);
  const country = readHeader('x-vercel-ip-country', 2);

  if (!hasCoordinates && !city && !region && !country) return null;

  return {
    ip_address: null,
    isp: null,
    city,
    region,
    country,
    latitude: hasCoordinates ? latitude : null,
    longitude: hasCoordinates ? longitude : null,
    network_source: 'vercel-geo'
  };
}

async function lookupNetworkInfo(ip, req) {
  if (isPublicIp(ip)) {
    const direct = await fetchNetworkInfo(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=ip,success,city,region,country,latitude,longitude,connection.isp`
    );

    if (direct) {
      return { ...direct, network_source: 'public-ip' };
    }
  }

  // Use Vercel's approximate IP-location headers when an upstream proxy
  // does not forward the public IP. This path runs only after consent.
  const vercelGeo = vercelGeoInfo(req);
  if (vercelGeo) return vercelGeo;

  if (!isProduction) {
    const shared = await fetchNetworkInfo(
      'https://ipwho.is/?fields=ip,success,city,region,country,latitude,longitude,connection.isp'
    );

    if (shared) {
      return { ...shared, network_source: 'shared-network' };
    }
  }

  return {
    ip_address: null,
    isp: null,
    city: null,
    region: null,
    country: null,
    latitude: null,
    longitude: null,
    network_source: null
  };
}

async function logLogin(user, req) {
  const ua = req.get('user-agent') || '';
  const d = deviceDetails(ua);

  const ip = user.network_info_consent ? clientIp(req) : null;

  const network = user.network_info_consent
    ? await lookupNetworkInfo(ip, req)
    : {
        ip_address: null,
        isp: null,
        city: null,
        region: null,
        country: null,
        latitude: null,
        longitude: null,
        network_source: null
      };

  const clientAddress = ip || null;

  const publicAddress = isPublicIp(ip)
    ? ip
    : (
        network.network_source === 'shared-network' &&
        isPublicIp(network.ip_address)
          ? network.ip_address
          : null
      );

  db.prepare(`
    INSERT INTO sessions_log
    (user_id,device,browser,os,user_agent,isp,city,region,country,network_source,ip_address,client_ip,latitude,longitude)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    user.id,
    d.device,
    d.browser,
    d.os,
    ua.slice(0, 500),
    network.isp,
    network.city,
    network.region,
    network.country,
    network.network_source,
    publicAddress,
    clientAddress,
    network.latitude,
    network.longitude
  );

  db.prepare(
    'UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?'
  ).run(user.id);
}

// Health check
app.get('/api/health', (_, res) => {
  res.json({ ok: true, app: 'InstaClone' });
});

// Current user
app.get('/api/me', (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null });
  }

  const u = db.prepare(
    'SELECT * FROM users WHERE id=?'
  ).get(req.session.userId);

  if (!u || u.status !== 'active') {
    return res.json({ user: null });
  }

  res.json({ user: publicUser(u) });
});

// Registration
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const {
    username,
    email,
    password,
    networkInfoConsent
  } = req.body || {};

  if (networkInfoConsent !== true) {
    return res.status(400).json({
      error: 'Please review and consent to the optional ISP and approximate location information notice.'
    });
  }

  if (!/^[a-zA-Z0-9._]{3,24}$/.test(username || '')) {
    return res.status(400).json({
      error: 'Username must be 3–24 characters (letters, numbers, dots or underscores).'
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) {
    return res.status(400).json({
      error: 'Enter a valid email address.'
    });
  }

  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 72
  ) {
    return res.status(400).json({
      error: 'Password must be 8–72 characters.'
    });
  }

  try {
    const hash = await bcrypt.hash(password, 12);

    const info = db.prepare(`
      INSERT INTO users
      (username,email,password_hash,network_info_consent)
      VALUES (?,?,?,1)
    `).run(username, email, hash);

    const user = db.prepare(
      'SELECT * FROM users WHERE id=?'
    ).get(info.lastInsertRowid);

    req.session.userId = user.id;

    try {
      await logLogin(user, req);
    } catch (logError) {
      console.error('Registration network logging failed:', logError);
    }

    req.session.save(saveError => {
      if (saveError) {
        console.error('Registration session save failed:', saveError);
        return res.status(500).json({
          error: 'Account was created, but the session could not be started. Please sign in.'
        });
      }

      return res.status(201).json({
        user: publicUser(user)
      });
    });
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();

    if (message.includes('unique') || message.includes('constraint')) {
      return res.status(409).json({
        error: 'Username or email is already registered.'
      });
    }

    console.error('Registration failed:', error);

    return res.status(500).json({
      error: 'Registration failed due to a server error.'
    });
  }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const identity = String(
    req.body?.identity || ''
  ).trim().slice(0, 120);

  const password = typeof req.body?.password === 'string'
    ? req.body.password : '';

  if (!identity || !password) {
    return res.status(400).json({
      error: 'Enter your username/email and password.'
    });
  }

  const user = db.prepare(`
    SELECT * FROM users
    WHERE username=? COLLATE NOCASE OR email=? COLLATE NOCASE
  `).get(identity, identity);

  const now = Date.now();

  if (user?.locked_until) {
    const lockEnd = new Date(
      `${user.locked_until.replace(' ', 'T')}Z`
    ).getTime();

    if (Number.isFinite(lockEnd) && lockEnd > now) {
      const minutes = Math.max(
        1,
        Math.ceil((lockEnd - now) / 60000)
      );

      return res.status(429).json({
        error: `This account is temporarily locked after 3 failed attempts. Try again in about ${minutes} minute(s).`
      });
    }

    if (Number.isFinite(lockEnd) && lockEnd <= now) {
      db.prepare(`
        UPDATE users
        SET failed_attempts=0, locked_until=NULL
        WHERE id=?
      `).run(user.id);

      user.failed_attempts = 0;
      user.locked_until = null;
    }
  }

  const valid = user && await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!valid) {
    const d = deviceDetails(req.get('user-agent') || '');

    const attemptNumber = user
      ? Number(user.failed_attempts || 0) + 1
      : Number(db.prepare(`
          SELECT COUNT(*) AS n
          FROM security_events
          WHERE attempted_identity=? COLLATE NOCASE
          AND created_at >= datetime('now','-15 minutes')
        `).get(identity).n) + 1;

    const lockUntil = user && attemptNumber >= 3
      ? new Date(now + 15 * 60 * 1000)
          .toISOString().replace('T', ' ').slice(0, 19)
      : null;

    if (user) {
      db.prepare(`
        UPDATE users
        SET failed_attempts=?, locked_until=?
        WHERE id=?
      `).run(Math.min(attemptNumber, 3), lockUntil, user.id);
    }

    db.prepare(`
      INSERT INTO security_events
      (user_id,attempted_identity,attempt_number,device,browser,os,event_type,locked_until)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(
      user?.id ?? null,
      identity,
      attemptNumber,
      d.device,
      d.browser,
      d.os,
      lockUntil ? 'account_locked' : 'failed_login',
      lockUntil
    );

    if (lockUntil) {
      return res.status(429).json({
        error: 'Too many failed attempts. This account is locked for 15 minutes.'
      });
    }

    return res.status(401).json({
      error: 'Incorrect username/email or password.'
    });
  }

  if (user.status !== 'active') {
    return res.status(403).json({
      error: 'This account is currently suspended.'
    });
  }

  db.prepare(`
    UPDATE users
    SET failed_attempts=0, locked_until=NULL
    WHERE id=?
  `).run(user.id);

  req.session.regenerate(async err => {
    if (err) {
      return res.status(500).json({
        error: 'Could not start a secure session.'
      });
    }

    req.session.userId = user.id;

    try {
      await logLogin(user, req);
    } catch (e) {
      console.error('Sign-in metadata logging failed:', e);
    }

    req.session.save(saveError => {
      if (saveError) {
        console.error('Login session save failed:', saveError);
        return res.status(500).json({
          error: 'Could not save your login session.'
        });
      }

      res.json({ user: publicUser(user) });
    });
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('instaclone.sid');
    res.json({ ok: true });
  });
});

// Feed
app.get('/api/feed', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT p.*,u.username,u.avatar,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) likes,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) comments,
      EXISTS(
        SELECT 1 FROM likes l
        WHERE l.post_id=p.id AND l.user_id=?
      ) liked
    FROM posts p
    JOIN users u ON u.id=p.user_id
    WHERE u.status='active'
    ORDER BY p.created_at DESC
    LIMIT 100
  `).all(req.user.id);

  res.json({ posts: rows });
});

// Create post
app.post('/api/posts', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'Choose an image (JPG, PNG, WEBP or GIF).'
    });
  }

  const caption = String(req.body.caption || '').slice(0, 1000);

  const info = db.prepare(`
    INSERT INTO posts (user_id,image,caption)
    VALUES (?,?,?)
  `).run(
    req.user.id,
    `/uploads/${req.file.filename}`,
    caption
  );

  res.status(201).json({ id: info.lastInsertRowid });
});

// Like post
app.post('/api/posts/:id/like', requireAuth, (req, res) => {
  const id = Number(req.params.id);

  const exists = db.prepare(`
    SELECT 1 FROM likes WHERE user_id=? AND post_id=?
  `).get(req.user.id, id);

  if (exists) {
    db.prepare(`
      DELETE FROM likes WHERE user_id=? AND post_id=?
    `).run(req.user.id, id);
  } else {
    db.prepare(`
      INSERT OR IGNORE INTO likes(user_id,post_id)
      VALUES(?,?)
    `).run(req.user.id, id);
  }

  res.json({ liked: !exists });
});

// Comments
app.get('/api/posts/:id/comments', requireAuth, (req, res) => {
  const comments = db.prepare(`
    SELECT c.id,c.body,c.created_at,u.username
    FROM comments c
    JOIN users u ON u.id=c.user_id
    WHERE c.post_id=?
    ORDER BY c.created_at ASC
  `).all(Number(req.params.id));

  res.json({ comments });
});

app.post('/api/posts/:id/comments', requireAuth, (req, res) => {
  const body = String(req.body.body || '').trim().slice(0, 500);

  if (!body) {
    return res.status(400).json({
      error: 'Write a comment first.'
    });
  }

  db.prepare(`
    INSERT INTO comments(user_id,post_id,body)
    VALUES(?,?,?)
  `).run(req.user.id, Number(req.params.id), body);

  res.status(201).json({ ok: true });
});

// User profile
app.get('/api/users/:username', requireAuth, (req, res) => {
  const u = db.prepare(`
    SELECT * FROM users
    WHERE username=? COLLATE NOCASE AND status='active'
  `).get(req.params.username);

  if (!u) {
    return res.status(404).json({
      error: 'User not found.'
    });
  }

  const counts = {
    posts: db.prepare(
      'SELECT COUNT(*) n FROM posts WHERE user_id=?'
    ).get(u.id).n,

    followers: db.prepare(
      'SELECT COUNT(*) n FROM follows WHERE following_id=?'
    ).get(u.id).n,

    following: db.prepare(
      'SELECT COUNT(*) n FROM follows WHERE follower_id=?'
    ).get(u.id).n
  };

  const following = !!db.prepare(`
    SELECT 1 FROM follows
    WHERE follower_id=? AND following_id=?
  `).get(req.user.id, u.id);

  const posts = db.prepare(`
    SELECT * FROM posts
    WHERE user_id=?
    ORDER BY created_at DESC
  `).all(u.id);

  res.json({
    user: publicUser(u),
    counts,
    following,
    posts
  });
});

// Follow user
app.post('/api/users/:id/follow', requireAuth, (req, res) => {
  const id = Number(req.params.id);

  if (id === req.user.id) {
    return res.status(400).json({
      error: 'You cannot follow yourself.'
    });
  }

  const exists = db.prepare(`
    SELECT 1 FROM follows
    WHERE follower_id=? AND following_id=?
  `).get(req.user.id, id);

  if (exists) {
    db.prepare(`
      DELETE FROM follows
      WHERE follower_id=? AND following_id=?
    `).run(req.user.id, id);
  } else {
    db.prepare(`
      INSERT OR IGNORE INTO follows(follower_id,following_id)
      VALUES(?,?)
    `).run(req.user.id, id);
  }

  res.json({ following: !exists });
});

// Update profile
app.put('/api/profile', requireAuth, (req, res) => {
  const bio = String(req.body.bio || '').slice(0, 160);

  db.prepare(`
    UPDATE users SET bio=? WHERE id=?
  `).run(bio, req.user.id);

  res.json({ bio });
});

// Admin summary
app.get('/api/admin/summary', requireAuth, requireAdmin, (_, res) => {
  const count = q => db.prepare(q).get().n;

  res.json({
    users: count("SELECT COUNT(*) n FROM users WHERE role='user'"),
    active: count("SELECT COUNT(*) n FROM users WHERE role='user' AND status='active'"),
    posts: count("SELECT COUNT(*) n FROM posts"),
    logins: count("SELECT COUNT(*) n FROM sessions_log"),
    recent: db.prepare(`
      SELECT s.*,u.username
      FROM sessions_log s
      JOIN users u ON u.id=s.user_id
      ORDER BY s.logged_in_at DESC
      LIMIT 8
    `).all()
  });
});

// Admin users
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const q = `%${String(req.query.q || '').slice(0, 60)}%`;

  const users = db.prepare(`
    SELECT
      u.id,u.username,u.email,u.bio,u.role,u.status,u.created_at,u.last_login,
      u.network_info_consent,
      (SELECT s.device FROM sessions_log s WHERE s.user_id=u.id ORDER BY s.logged_in_at DESC LIMIT 1) device,
      (SELECT s.browser FROM sessions_log s WHERE s.user_id=u.id ORDER BY s.logged_in_at DESC LIMIT 1) browser,
      (SELECT s.os FROM sessions_log s WHERE s.user_id=u.id ORDER BY s.logged_in_at DESC LIMIT 1) os,
      (SELECT s.isp FROM sessions_log s WHERE s.user_id=u.id ORDER BY s.logged_in_at DESC LIMIT 1) isp,
      (SELECT s.city FROM sessions_log s WHERE s.user_id=u.id ORDER BY s.logged_in_at DESC LIMIT 1) city,
      (SELECT s.region FROM sessions_log s WHERE s.user_id=u.id ORDER BY s.logged_in_at DESC LIMIT 1) region,
      (SELECT s.country FROM sessions_log s WHERE s.user_id=u.id ORDER BY s.logged_in_at DESC LIMIT 1) country,
      (SELECT s.network_source FROM sessions_log s WHERE s.user_id=u.id ORDER BY s.logged_in_at DESC LIMIT 1) network_source,
      (SELECT s.ip_address FROM sessions_log s WHERE s.user_id=u.id ORDER BY s.logged_in_at DESC LIMIT 1) ip_address,
      (SELECT s.client_ip FROM sessions_log s WHERE s.user_id=u.id ORDER BY s.logged_in_at DESC LIMIT 1) client_ip,
      (SELECT s.latitude FROM sessions_log s WHERE s.user_id=u.id ORDER BY s.logged_in_at DESC LIMIT 1) latitude,
      (SELECT s.longitude FROM sessions_log s WHERE s.user_id=u.id ORDER BY s.logged_in_at DESC LIMIT 1) longitude
    FROM users u
    WHERE u.role='user'
    AND (u.username LIKE ? OR u.email LIKE ?)
    ORDER BY u.created_at DESC
  `).all(q, q);

  res.json({ users });
});

// User sessions
app.get('/api/admin/users/:id/sessions', requireAuth, requireAdmin, (req, res) => {
  const sessions = db.prepare(`
    SELECT device,browser,os,isp,city,region,country,network_source,
      ip_address,client_ip,latitude,longitude,logged_in_at
    FROM sessions_log
    WHERE user_id=?
    ORDER BY logged_in_at DESC
    LIMIT 30
  `).all(Number(req.params.id));

  res.json({ sessions });
});

// Security events
app.get('/api/admin/security-events', requireAuth, requireAdmin, (_, res) => {
  const events = db.prepare(`
    SELECT id,attempted_identity,attempt_number,device,browser,os,
      event_type,locked_until,created_at
    FROM security_events
    ORDER BY created_at DESC,id DESC
    LIMIT 50
  `).all();

  res.json({ events });
});

// Unlock account
app.post('/api/admin/users/:id/unlock', requireAuth, requireAdmin, (req, res) => {
  db.prepare(`
    UPDATE users
    SET failed_attempts=0,locked_until=NULL
    WHERE id=? AND role='user'
  `).run(Number(req.params.id));

  res.json({ ok: true });
});

// Change user status
app.patch('/api/admin/users/:id/status', requireAuth, requireAdmin, (req, res) => {
  const status = req.body.status;

  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({
      error: 'Invalid status.'
    });
  }

  db.prepare(`
    UPDATE users SET status=?
    WHERE id=? AND role='user'
  `).run(status, Number(req.params.id));

  res.json({ ok: true });
});

// Delete user
app.delete('/api/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare(`
    DELETE FROM users WHERE id=? AND role='user'
  `).run(Number(req.params.id));

  res.json({ ok: true });
});

// Serve frontend if this same service also contains the Vite build.
if (isProduction) {
  const dist = path.join(process.cwd(), 'dist');

  app.use(express.static(dist));

  app.get('*', (req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// Create or synchronize the administrator from Render environment variables.
const adminUsername = String(
  process.env.ADMIN_USERNAME || 'admin'
).trim();

const adminPassword = String(
  process.env.ADMIN_PASSWORD || ''
);

if (!process.env.SESSION_SECRET && isProduction) {
  throw new Error(
    'SESSION_SECRET must be set in the production environment.'
  );
}

if (adminUsername.length < 3 || adminUsername.length > 24) {
  throw new Error(
    'ADMIN_USERNAME must be between 3 and 24 characters.'
  );
}

if (adminPassword.length < 12 || adminPassword.length > 72) {
  throw new Error(
    'ADMIN_PASSWORD must be between 12 and 72 characters. Set it in Render environment variables.'
  );
}

const adminHash = await bcrypt.hash(adminPassword, 12);

const existingAdmin = db.prepare(`
  SELECT id,role FROM users
  WHERE username=? COLLATE NOCASE
`).get(adminUsername);

if (!existingAdmin) {
  db.prepare(`
    INSERT INTO users
    (username,email,password_hash,role,status)
    VALUES (?,?,?,'admin','active')
  `).run(
    adminUsername,
    `${adminUsername.toLowerCase()}@instaclone.local`,
    adminHash
  );

  console.log(`Administrator account '${adminUsername}' created.`);
} else {
  db.prepare(`
    UPDATE users
    SET password_hash=?,role='admin',status='active'
    WHERE id=?
  `).run(adminHash, existingAdmin.id);

  console.log(
    `Administrator account '${adminUsername}' credentials synchronized from environment.`
  );
}

// Central error handler
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  console.error('API error:', err);

  if (String(err?.message || '').startsWith('CORS blocked origin:')) {
    return res.status(403).json({
      error: 'This website origin is not allowed by the API. Check FRONTEND_URL in Render.'
    });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: err.code === 'LIMIT_FILE_SIZE'
        ? 'Image must be 8 MB or smaller.'
        : 'Image upload failed.'
    });
  }

  return res.status(500).json({
    error: 'Something went wrong on the server.'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`InstaClone API listening on port ${PORT}`);
});
