import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { addDays, validDate } from './dates.js';
export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive:true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', manager TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '', startDate TEXT NOT NULL, endDate TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications (slot TEXT PRIMARY KEY, payload TEXT NOT NULL, createdAt TEXT NOT NULL, readAt TEXT, mailState TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, lastAttempt TEXT, error TEXT);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  const columns=new Set(db.prepare('PRAGMA table_info(companies)').all().map(c=>c.name));
  if(!columns.has('mainKeyword')) db.exec("ALTER TABLE companies ADD COLUMN mainKeyword TEXT NOT NULL DEFAULT ''");
  if(!columns.has('existingEndDate')) db.exec("ALTER TABLE companies ADD COLUMN existingEndDate TEXT NOT NULL DEFAULT ''");
  if(!db.prepare("SELECT value FROM settings WHERE key='derived-end-date-v1'").get()) {
    db.exec('BEGIN');
    try {
      for(const c of db.prepare('SELECT id,startDate,endDate,existingEndDate FROM companies').all()) {
        const derived=validDate(c.startDate)?addDays(c.startDate,30):'';
        if(derived!==c.endDate) db.prepare('UPDATE companies SET existingEndDate=?,endDate=?,updatedAt=? WHERE id=?').run(c.existingEndDate||c.endDate,derived,new Date().toISOString(),c.id);
      }
      db.prepare("INSERT INTO settings(key,value) VALUES('derived-end-date-v1','complete')").run();
      db.exec('COMMIT');
    } catch(e) {db.exec('ROLLBACK');throw e;}
  }
  return db;
}
