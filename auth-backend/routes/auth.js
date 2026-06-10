/**
 * auth.js — Authentication Routes
 * Handles signup, login, profile, token verification, and scan history.
 * Uses SQLite via sql.js for fast, reliable, zero-config storage.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { queryAll, queryOne, runSql } = require('../config/database');
const { authenticateToken, generateToken } = require('../middleware/auth');

const router = express.Router();

// ─── Constants ───
const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

// ─── Helper: Validate password strength ───
function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Password must contain a special character');
  return errors;
}

// ═══════════════════════════════════════════
// POST /api/auth/signup
// ═══════════════════════════════════════════
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // 1. Validate required fields
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required',
      });
    }

    // 2. Validate name
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Name must be between 2 and 100 characters',
      });
    }

    // 3. Validate email
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address',
      });
    }

    // 4. Validate password strength
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: passwordErrors[0],
        passwordErrors,
      });
    }

    // 5. Confirm password match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match',
      });
    }

    // 6. Check if email already exists
    const existingUser = queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists',
      });
    }

    // 7. Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 8. Insert user
    const result = runSql(
      `INSERT INTO users (name, email, password_hash, signup_date) VALUES (?, ?, ?, datetime('now'))`,
      [trimmedName, email.toLowerCase().trim(), passwordHash]
    );

    // 9. Generate JWT token
    const user = {
      id: result.lastInsertRowid,
      email: email.toLowerCase().trim(),
      name: trimmedName,
    };
    const token = generateToken(user);

    console.log(`  ✅ New user registered: ${user.email}`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({
      success: false,
      error: 'Server error during registration. Please try again.',
    });
  }
});

// ═══════════════════════════════════════════
// POST /api/auth/login
// ═══════════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // 2. Validate email format
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address',
      });
    }

    // 3. Find user by email
    const user = queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // 4. Check if account is locked
    if (user.is_locked && user.locked_until) {
      const lockExpiry = new Date(user.locked_until);
      if (lockExpiry > new Date()) {
        const minutesLeft = Math.ceil((lockExpiry - new Date()) / 60000);
        return res.status(423).json({
          success: false,
          error: `Account is locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
        });
      } else {
        // Lock expired — reset
        runSql(
          'UPDATE users SET is_locked = 0, login_attempts = 0, locked_until = NULL WHERE id = ?',
          [user.id]
        );
        user.is_locked = 0;
        user.login_attempts = 0;
      }
    }

    // 5. Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      const newAttempts = (user.login_attempts || 0) + 1;

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000).toISOString();
        runSql(
          'UPDATE users SET login_attempts = ?, is_locked = 1, locked_until = ? WHERE id = ?',
          [newAttempts, lockUntil, user.id]
        );
        return res.status(423).json({
          success: false,
          error: `Too many failed attempts. Account locked for ${LOCK_DURATION_MINUTES} minutes.`,
        });
      }

      runSql('UPDATE users SET login_attempts = ? WHERE id = ?', [newAttempts, user.id]);

      const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;
      return res.status(401).json({
        success: false,
        error: `Invalid email or password. ${remaining} attempt(s) remaining.`,
      });
    }

    // 6. Successful login — reset attempts and update last_login
    runSql(
      "UPDATE users SET login_attempts = 0, is_locked = 0, locked_until = NULL, last_login = datetime('now') WHERE id = ?",
      [user.id]
    );

    // 7. Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    console.log(`  ✅ User logged in: ${user.email}`);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      error: 'Server error during login. Please try again.',
    });
  }
});

// ═══════════════════════════════════════════
// GET /api/auth/profile  (Protected)
// ═══════════════════════════════════════════
router.get('/profile', authenticateToken, (req, res) => {
  try {
    const user = queryOne(
      'SELECT id, name, email, signup_date, last_login FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ success: false, error: 'Error fetching profile' });
  }
});

// ═══════════════════════════════════════════
// POST /api/auth/verify-token
// ═══════════════════════════════════════════
router.post('/verify-token', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ═══════════════════════════════════════════
// POST /api/auth/history/save  (Save scan — Protected)
// ═══════════════════════════════════════════
router.post('/history/save', authenticateToken, (req, res) => {
  try {
    const scanData = req.body;
    const userId = req.user.id;

    const result = runSql(
      `INSERT INTO scan_history (user_id, scan_data, overall_health, priority, advice, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [
        userId,
        JSON.stringify(scanData),
        scanData.overallHealth || 0,
        scanData.priority || 'Low',
        scanData.advice || scanData.summary || null,
      ]
    );

    console.log(`  📝 Scan saved for user ${req.user.email} (id: ${result.lastInsertRowid})`);

    res.status(201).json({
      success: true,
      id: result.lastInsertRowid,
      message: 'Scan saved to history',
    });
  } catch (err) {
    console.error('Save history error:', err);
    res.status(500).json({ success: false, error: 'Error saving scan history' });
  }
});

// ═══════════════════════════════════════════
// GET /api/auth/history  (Get user history — Protected)
// ═══════════════════════════════════════════
router.get('/history', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;

    const rows = queryAll(
      'SELECT * FROM scan_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );

    // Parse the JSON scan_data back into objects
    const history = rows.map(row => {
      let scanData = {};
      try {
        scanData = JSON.parse(row.scan_data);
      } catch { /* ignore */ }

      return {
        id: row.id,
        ...scanData,
        overallHealth: row.overall_health,
        priority: row.priority,
        advice: row.advice,
        date: row.created_at,
      };
    });

    res.json({ success: true, history, total: history.length });
  } catch (err) {
    console.error('Fetch history error:', err);
    res.status(500).json({ success: false, error: 'Error fetching scan history' });
  }
});

// ═══════════════════════════════════════════
// DELETE /api/auth/history/:id  (Delete one — Protected)
// ═══════════════════════════════════════════
router.delete('/history/:id', authenticateToken, (req, res) => {
  try {
    const scanId = parseInt(req.params.id);
    const userId = req.user.id;

    const result = runSql(
      'DELETE FROM scan_history WHERE id = ? AND user_id = ?',
      [scanId, userId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Scan not found or unauthorized' });
    }

    res.json({ success: true, message: 'Scan deleted' });
  } catch (err) {
    console.error('Delete history error:', err);
    res.status(500).json({ success: false, error: 'Error deleting scan' });
  }
});

// ═══════════════════════════════════════════
// DELETE /api/auth/history  (Clear all — Protected)
// ═══════════════════════════════════════════
router.delete('/history', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const result = runSql('DELETE FROM scan_history WHERE user_id = ?', [userId]);
    res.json({ success: true, message: `Cleared ${result.changes} scan(s)`, deleted: result.changes });
  } catch (err) {
    console.error('Clear history error:', err);
    res.status(500).json({ success: false, error: 'Error clearing history' });
  }
});

module.exports = router;
