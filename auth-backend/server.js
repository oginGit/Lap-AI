/**
 * server.js — LaptopMD Authentication Server
 * Express server handling user authentication with SQLite (sql.js) and JWT.
 * Zero-config database — no MySQL server required.
 */
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 5052;

// ─── CORS ───
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parser ───
// 10mb supports large JSON payloads; actual file uploads use multipart (multer)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate Limiting ───
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    error: 'Too many requests. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter);

// ─── Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);

// ─── Health Check ───
app.get('/api/auth-health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'LaptopMD Auth Backend',
    database: 'SQLite (sql.js)',
    time: new Date().toISOString(),
  });
});

// ─── 404 Handler ───
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// ─── Error Handler ───
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ─── Start Server ───
async function startServer() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  LaptopMD — Authentication Server');
  console.log('═══════════════════════════════════════════════');

  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('\n  ⚠️  Database initialization failed!');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`  🚀 Auth API running at http://localhost:${PORT}`);
    console.log(`  📡 Endpoints:`);
    console.log(`     POST /api/auth/signup`);
    console.log(`     POST /api/auth/login`);
    console.log(`     GET  /api/auth/profile`);
    console.log(`     POST /api/auth/verify-token`);
    console.log(`     POST /api/auth/history/save`);
    console.log(`     GET  /api/auth/history`);
    console.log(`     DEL  /api/auth/history/:id`);
    console.log(`     DEL  /api/auth/history`);
    console.log(`  📡 AI Endpoints:`);
    console.log(`     POST /api/ai/chat   (text chat)`);
    console.log(`     POST /api/ai/voice  (voice → text → AI)`);
    console.log(`     POST /api/ai/vision (image analysis)`);
    console.log('═══════════════════════════════════════════════\n');
  });
}

startServer();
