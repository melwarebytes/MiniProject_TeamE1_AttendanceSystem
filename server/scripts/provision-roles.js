// Run with the migration owner, never with the runtime application's credentials.
require('dotenv').config();
const { Client } = require('pg');
const crypto = require('crypto');
async function main() {
  const db = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL });
  await db.connect();
  for (const [role, password] of [['sams_app', process.env.APP_DB_PASSWORD], ['sams_retention', process.env.RETENTION_DB_PASSWORD]]) {
    if (!password || password.length < 16) throw new Error(`Supply a password of at least 16 characters for ${role}`);
    const exists = await db.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role]);
    if (!exists.rowCount) await db.query(`CREATE ROLE ${role} LOGIN`);
    // Server-side format quotes the password as a SQL literal; never log it.
    const { rows } = await db.query("SELECT format('ALTER ROLE %I PASSWORD %L', $1::text, $2::text) AS sql", [role, password]);
    await db.query(rows[0].sql);
    await db.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await db.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
    await db.query(`REVOKE ALL ON _prisma_migrations FROM ${role}`);
    await db.query(`REVOKE ALL ON audit_logs FROM ${role}`);
    await db.query(`GRANT SELECT, INSERT ON audit_logs TO ${role}`);
  }
  await db.query('GRANT DELETE ON audit_logs TO sams_retention');
  // Even the dedicated retention login cannot delete entries younger than 3 years.
  await db.query(`CREATE OR REPLACE FUNCTION guard_audit_retention() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF CURRENT_USER = 'sams_retention' AND OLD."createdAt" >= CURRENT_TIMESTAMP - INTERVAL '3 years' THEN
        RAISE EXCEPTION 'Audit entries must be retained for three years';
      END IF;
      RETURN OLD;
    END $$`);
  await db.query('DROP TRIGGER IF EXISTS audit_retention_guard ON audit_logs');
  await db.query('CREATE TRIGGER audit_retention_guard BEFORE DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION guard_audit_retention()');
  await db.end();
  console.log('Runtime and retention roles provisioned. Migration owner remains separate.');
}
main().catch(error => { console.error(error.message.replace(process.env.APP_DB_PASSWORD || crypto.randomUUID(), '[redacted]')); process.exit(1); });
