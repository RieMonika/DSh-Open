'use strict';

/**
 * 数据库层（存储）
 * ------------------------------------------------------------
 * 首选 Node 内置的 node:sqlite（Electron 43 自带，不需要编译原生模块，
 * 也就不需要联网装依赖）。
 *
 * 万一某些版本的运行时没带这个模块，会自动退化成 JSON 文件存储 ——
 * 功能会受限（查询能力差），但软件绝不会因为存储不可用而打不开。
 */

const fs = require('node:fs');
const path = require('node:path');
const P = require('./paths');
const log = require('./logger');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  channel    TEXT NOT NULL,
  account    TEXT,
  title      TEXT,
  kind       TEXT,
  avatar     TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  channel         TEXT NOT NULL,
  account         TEXT,
  conversation_id TEXT NOT NULL,
  sender_id       TEXT,
  sender_name     TEXT,
  content         TEXT,
  raw             TEXT,
  role            TEXT,
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conv
  ON messages(conversation_id, created_at);
`;

let sqlite = null; // DatabaseSync 实例
let jsonStore = null; // JSON 兜底
let backend = 'none';
let jsonFile = '';

// ---------------------------------------------------------------------------
// JSON 兜底实现
// ---------------------------------------------------------------------------

function jsonInit() {
  jsonFile = path.join(P.data, 'db-fallback.json');
  P.ensureDir(P.data);
  try {
    jsonStore = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  } catch (_) {
    jsonStore = { meta: {}, conversations: {}, messages: [] };
  }
  jsonStore.meta = jsonStore.meta || {};
  jsonStore.conversations = jsonStore.conversations || {};
  jsonStore.messages = jsonStore.messages || [];
  backend = 'json';
}

let jsonTimer = null;
function jsonFlush() {
  clearTimeout(jsonTimer);
  jsonTimer = setTimeout(() => {
    try {
      fs.writeFileSync(jsonFile, JSON.stringify(jsonStore), 'utf8');
    } catch (err) {
      log.ex('db: JSON 落盘失败', err);
    }
  }, 200);
}

// ---------------------------------------------------------------------------
// 对外
// ---------------------------------------------------------------------------

const db = {
  init() {
    P.ensureDir(P.data);
    try {
      const { DatabaseSync } = require('node:sqlite');
      sqlite = new DatabaseSync(P.databaseFile);
      sqlite.exec('PRAGMA journal_mode = WAL;');
      sqlite.exec('PRAGMA foreign_keys = ON;');
      sqlite.exec(SCHEMA);
      backend = 'sqlite';
      log.info('db: 已启用 SQLite ->', P.databaseFile);
    } catch (err) {
      log.warn('db: node:sqlite 不可用，改用 JSON 兜底 —', err && err.message);
      try {
        if (sqlite) sqlite.close();
      } catch (_) {
        /* ignore */
      }
      sqlite = null;
      jsonInit();
    }
    return backend;
  },

  get backend() {
    return backend;
  },

  /** 任意 SQL（建表、迁移用） */
  exec(sql) {
    if (!sqlite) return null;
    return sqlite.exec(sql);
  },

  run(sql, ...params) {
    if (!sqlite) return null;
    return sqlite.prepare(sql).run(...params);
  },

  all(sql, ...params) {
    if (!sqlite) return [];
    return sqlite.prepare(sql).all(...params);
  },

  get(sql, ...params) {
    if (!sqlite) return undefined;
    return sqlite.prepare(sql).get(...params);
  },

  // ---- 键值（给内部状态用，表名永远是 meta） ----
  kvGet(key, fallback = null) {
    if (sqlite) {
      const row = db.get('SELECT value FROM meta WHERE key = ?', key);
      if (!row) return fallback;
      try {
        return JSON.parse(row.value);
      } catch (_) {
        return row.value;
      }
    }
    if (!jsonStore) return fallback;
    return key in jsonStore.meta ? jsonStore.meta[key] : fallback;
  },

  kvSet(key, value) {
    if (sqlite) {
      db.run(
        'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key,
        JSON.stringify(value),
      );
      return;
    }
    if (!jsonStore) return;
    jsonStore.meta[key] = value;
    jsonFlush();
  },

  close() {
    try {
      if (sqlite) sqlite.close();
    } catch (_) {
      /* ignore */
    }
    sqlite = null;
  },
};

module.exports = db;
