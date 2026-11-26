#!/usr/bin/env node
/**
 * TRUST-MED AI — Demo Data Seeder
 * Loads synthetic demonstration data into the configured Supabase instance.
 * ALL DATA IS SYNTHETIC AND FICTIONAL — do not use real patient data.
 *
 * Usage: node scripts/seed.js
 * Requires: SUPABASE_DB_URL in environment
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error('❌ SUPABASE_DB_URL is not set.')
  process.exit(1)
}

const seedFile = join(__dirname, '..', 'supabase', 'seed', 'demo-data.sql')
const sql = readFileSync(seedFile, 'utf-8')

console.log('🏥 TRUST-MED AI — Demo Data Seeder')
console.log('⚠  ALL DATA IS SYNTHETIC AND FICTIONAL\n')
console.log(`Seed SQL loaded (${sql.length} chars)`)
console.log('\nTo apply seed data:')
console.log('  Supabase Dashboard → SQL Editor → paste supabase/seed/demo-data.sql')
console.log('  OR: psql $SUPABASE_DB_URL -f supabase/seed/demo-data.sql')
