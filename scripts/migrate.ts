import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  // Run full schema (idempotent — uses IF NOT EXISTS)
  const sql = readFileSync(join(__dirname, '../src/db/schema.sql'), 'utf8');
  await db.query(sql);

  // Additive column migrations (safe to re-run)
  const alterations = [
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'basic'`,
  ];

  for (const sql of alterations) {
    await db.query(sql);
  }

  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
