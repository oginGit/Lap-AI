/**
 * database.js — SQLite Database Connection (using sql.js — pure JS, no native deps)
 * Zero-config database — no MySQL server required.
 * Data is stored in a local file and persisted automatically.
 */
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'laptopmd.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

// Save database to disk
function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Auto-save every 30 seconds
let saveInterval = null;

// Initialize the database
async function initializeDatabase() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('  📂 Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('  📂 Created new database');
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      signup_date TEXT DEFAULT (datetime('now')),
      last_login TEXT DEFAULT NULL,
      login_attempts INTEGER DEFAULT 0,
      is_locked INTEGER DEFAULT 0,
      locked_until TEXT DEFAULT NULL,
      reset_token TEXT DEFAULT NULL,
      reset_token_expires TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS scan_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      scan_data TEXT NOT NULL,
      overall_health INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'Low',
      advice TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_scan_history_user ON scan_history(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_scan_history_date ON scan_history(created_at)`);

  // Save to disk
  saveDb();

  // Start auto-save interval
  if (saveInterval) clearInterval(saveInterval);
  saveInterval = setInterval(saveDb, 30000);

  // Save on process exit
  process.on('exit', saveDb);
  process.on('SIGINT', () => { saveDb(); process.exit(); });
  process.on('SIGTERM', () => { saveDb(); process.exit(); });

  return db;
}

// Test connection
async function testConnection() {
  try {
    if (!db) {
      await initializeDatabase();
    }
    const result = db.exec('SELECT COUNT(*) as count FROM users');
    const count = result.length > 0 ? result[0].values[0][0] : 0;
    console.log(`  ✅ SQLite connected — ${count} user(s) in database`);
    console.log(`  📁 Database file: ${DB_PATH}`);
    return true;
  } catch (err) {
    console.error('  ❌ SQLite error:', err.message);
    return false;
  }
}

// Helper: run a query and get results as objects
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: run a query and get single result as object
function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

// Helper: run an insert/update/delete and return changes info
function runSql(sql, params = []) {
  db.run(sql, params);
  const lastId = db.exec('SELECT last_insert_rowid() as id');
  const changes = db.exec('SELECT changes() as changes');
  saveDb(); // Persist immediately after writes
  return {
    lastInsertRowid: lastId.length > 0 ? lastId[0].values[0][0] : 0,
    changes: changes.length > 0 ? changes[0].values[0][0] : 0,
  };
}

function getDb() {
  return db;
}

module.exports = { getDb, testConnection, initializeDatabase, queryAll, queryOne, runSql, saveDb };
