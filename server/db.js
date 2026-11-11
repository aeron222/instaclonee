import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'server', 'data');
const dbPath = path.join(dataDir, 'instaclone.sqlite');
fs.mkdirSync(dataDir, { recursive: true });

const SQL = await initSqlJs();
const database = fs.existsSync(dbPath)
  ? new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)))
  : new SQL.Database();

function persist() {
  const bytes = database.export();
  fs.writeFileSync(dbPath, Buffer.from(bytes));
}

function normalizeArgs(args) {
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

export const db = {
  exec(sql) {
    database.exec(sql);
    persist();
  },
  prepare(sql) {
    return {
      run(...rawArgs) {
        const stmt = database.prepare(sql);
        try {
          stmt.bind(normalizeArgs(rawArgs));
          while (stmt.step()) { /* consume any returned rows */ }
        } finally {
          stmt.free();
        }
        const changes = database.getRowsModified();
        const row = database.exec('SELECT last_insert_rowid() AS id');
        const lastInsertRowid = row?.[0]?.values?.[0]?.[0] ?? 0;
        persist();
        return { changes, lastInsertRowid };
      },
      get(...rawArgs) {
        const stmt = database.prepare(sql);
        try {
          stmt.bind(normalizeArgs(rawArgs));
          return stmt.step() ? stmt.getAsObject() : undefined;
        } finally {
          stmt.free();
        }
      },
      all(...rawArgs) {
        const stmt = database.prepare(sql);
        const rows = [];
        try {
          stmt.bind(normalizeArgs(rawArgs));
          while (stmt.step()) rows.push(stmt.getAsObject());
          return rows;
        } finally {
          stmt.free();
        }
      }
    };
  }
};

// Safe, additive schema setup. Existing account and content data is preserved.
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    bio TEXT DEFAULT '',
    avatar TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TEXT,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device TEXT,
    browser TEXT,
    os TEXT,
    user_agent TEXT,
    isp TEXT,
    city TEXT,
    region TEXT,
    country TEXT,
    network_source TEXT,
    ip_address TEXT,
    client_ip TEXT,
    latitude REAL,
    longitude REAL,
    lookup_status TEXT,
    logged_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    image TEXT NOT NULL,
    caption TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, post_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(follower_id, following_id),
    FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(following_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    attempted_identity TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    device TEXT,
    browser TEXT,
    os TEXT,
    user_agent TEXT,
    client_ip TEXT,
    ip_address TEXT,
    isp TEXT,
    city TEXT,
    region TEXT,
    country TEXT,
    latitude REAL,
    longitude REAL,
    network_source TEXT,
    network_info_consent INTEGER,
    lookup_status TEXT,
    event_type TEXT NOT NULL DEFAULT 'failed_login',
    locked_until TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
  );
`);
// Migrate databases created by earlier project versions.
for (const statement of [
  'ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN locked_until TEXT',
  'ALTER TABLE users ADD COLUMN network_info_consent INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE sessions_log ADD COLUMN isp TEXT',
  'ALTER TABLE sessions_log ADD COLUMN city TEXT',
  'ALTER TABLE sessions_log ADD COLUMN region TEXT',
  'ALTER TABLE sessions_log ADD COLUMN country TEXT',
  'ALTER TABLE sessions_log ADD COLUMN network_source TEXT',
  'ALTER TABLE sessions_log ADD COLUMN ip_address TEXT',
  'ALTER TABLE sessions_log ADD COLUMN client_ip TEXT',
  'ALTER TABLE sessions_log ADD COLUMN latitude REAL',
  'ALTER TABLE sessions_log ADD COLUMN longitude REAL',
  'ALTER TABLE sessions_log ADD COLUMN lookup_status TEXT',
  'ALTER TABLE security_events ADD COLUMN user_agent TEXT',
  'ALTER TABLE security_events ADD COLUMN client_ip TEXT',
  'ALTER TABLE security_events ADD COLUMN ip_address TEXT',
  'ALTER TABLE security_events ADD COLUMN isp TEXT',
  'ALTER TABLE security_events ADD COLUMN city TEXT',
  'ALTER TABLE security_events ADD COLUMN region TEXT',
  'ALTER TABLE security_events ADD COLUMN country TEXT',
  'ALTER TABLE security_events ADD COLUMN latitude REAL',
  'ALTER TABLE security_events ADD COLUMN longitude REAL',
  'ALTER TABLE security_events ADD COLUMN network_source TEXT',
  'ALTER TABLE security_events ADD COLUMN network_info_consent INTEGER',
  'ALTER TABLE security_events ADD COLUMN lookup_status TEXT'
]) {
  try { database.exec(statement); } catch (error) {
    if (!String(error.message).toLowerCase().includes('duplicate column')) throw error;
  }
}
persist();
