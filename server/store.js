import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive:true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', manager TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '', startDate TEXT NOT NULL, endDate TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications (slot TEXT PRIMARY KEY, payload TEXT NOT NULL, createdAt TEXT NOT NULL, readAt TEXT, mailState TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, lastAttempt TEXT, error TEXT);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  return db;
}
