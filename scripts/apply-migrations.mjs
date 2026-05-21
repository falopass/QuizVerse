import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, '.env.local'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
const appliedFile = path.join(rootDir, 'supabase', '.applied-migrations.json');

interface AppliedRecord {
  applied: string[];
}

function readApplied(): AppliedRecord {
  try {
    return JSON.parse(fs.readFileSync(appliedFile, 'utf8'));
  } catch {
    return { applied: [] };
  }
}

function writeApplied(record: AppliedRecord) {
  fs.writeFileSync(appliedFile, JSON.stringify(record, null, 2), 'utf8');
}

async function main() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    process.exit(0);
  }

  const record = readApplied();
  const pending = files.filter((f) => !record.applied.includes(f));

  if (pending.length === 0) {
    console.log('All migrations already applied.');
    process.exit(0);
  }

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Applying ${file}...`);

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();

    if (error) {
      const { error: rawError } = await supabase.rpc('exec_sql_raw', {
        query: sql,
      });

      if (rawError) {
        console.error(`Failed to apply ${file}:`, rawError.message);
        console.log('Run this SQL manually in Supabase SQL Editor:');
        console.log('---');
        console.log(sql);
        console.log('---');
        process.exit(1);
      }
    }

    record.applied.push(file);
    writeApplied(record);
    console.log(`✓ ${file} applied`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
