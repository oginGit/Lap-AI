/**
 * initDb.js — Database Initialization Script
 * Creates the SQLite database and tables if they don't exist.
 * Run this once: node config/initDb.js
 *
 * Note: The database is now auto-initialized on server start,
 * so this script is optional but can be used to verify setup.
 */
const { testConnection, initializeDatabase } = require('./database');

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   LaptopMD — Database Initialization        ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  try {
    await initializeDatabase();
    console.log('✅ Database initialized successfully');

    const connected = await testConnection();
    if (connected) {
      console.log('\n🎉 Database initialization complete!');
      console.log('   Database: SQLite (sql.js)');
      console.log('   Tables: users, scan_history\n');
    }
  } catch (err) {
    console.error('❌ Error initializing database:', err.message);
    process.exit(1);
  }
}

main();
