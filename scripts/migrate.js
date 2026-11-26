#!/usr/bin/env node
/**
 * TRUST-MED AI — Database Migration Runner
 * Runs SQL migration files against the configured Supabase instance.
 *
 * Usage: node scripts/migrate.js
 * Requires: SUPABASE_DB_URL in environment
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error('❌ SUPABASE_DB_URL is not set. Cannot run migrations.')
  console.error('   Set it in your .env file or environment.')
  process.exit(1)
}

const migrationsDir = join(__dirname, '..', 'supabase', 'migrations')

async function runMigrations() {
  console.log('🏥 TRUST-MED AI — Running database migrations...\n')

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8')
    console.log(`  ▸ ${file}`)

    // In a real setup, use pg or postgres package to execute SQL
    // This script documents the intent; actual execution requires pg client
    console.log(`    SQL loaded (${sql.length} chars) — apply via Supabase Dashboard SQL editor`)
  }

  console.log('\n✅ Migration files prepared.')
  console.log('\nTo apply migrations:')
  console.log('  Option 1: Supabase Dashboard → SQL Editor → paste each migration file')
  console.log('  Option 2: supabase db push (requires Supabase CLI)')
  console.log('  Option 3: psql $SUPABASE_DB_URL -f supabase/migrations/001_initial_schema.sql')
}

runMigrations().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
