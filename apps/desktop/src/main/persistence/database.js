const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

function runMigrations(database, migrationsDirectory) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);

  const applied = database.prepare('SELECT version FROM schema_migrations').all()
    .map((row) => row.version);
  const appliedVersions = new Set(applied);
  const files = fs.readdirSync(migrationsDirectory)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();

  for (const filename of files) {
    const version = Number.parseInt(filename.split('_', 1)[0], 10);
    if (appliedVersions.has(version)) continue;

    const sql = fs.readFileSync(path.join(migrationsDirectory, filename), 'utf8');
    database.exec('BEGIN IMMEDIATE');
    try {
      database.exec(sql);
      database.prepare(`
        INSERT INTO schema_migrations (version, filename, applied_at)
        VALUES (?, ?, ?)
      `).run(version, filename, new Date().toISOString());
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
}

function openMeridianDatabase(databasePath, options = {}) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON');
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA synchronous = FULL');
  database.exec('PRAGMA busy_timeout = 5000');

  const migrationsDirectory = options.migrationsDirectory
    || path.join(__dirname, 'migrations');
  runMigrations(database, migrationsDirectory);
  return database;
}

module.exports = { openMeridianDatabase, runMigrations };
