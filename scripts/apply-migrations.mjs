// Aplica las migraciones de supabase/migrations con la CLI oficial de Supabase
// (`db push --db-url`). Requiere SUPABASE_DB_URL en .env.local (no se commitea).
// Nota: el remoto ya tiene las migraciones aplicadas a mano, así que la primera
// corrida requiere una sola vez (con SUPABASE_DB_URL exportada en el shell):
//   npx -y supabase@latest migration repair --db-url "$SUPABASE_DB_URL" --status applied <versiones>
// Este script no lo automatiza.
// La contraseña viaja en los argumentos del proceso: riesgo aceptado en máquina
// de un solo usuario; si el repo pasa a multi-usuario, se revisa.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.join(rootDir, '.env.local'), override: true });

const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error('Falta SUPABASE_DB_URL en .env.local.');
  console.error(
    'Se obtiene en Supabase Dashboard → Connect → connection string (URI, con la contraseña de la base).',
  );
  console.error('Sin esa variable este script no toca ninguna base remota.');
  process.exit(1);
}

if (!dbUrl.startsWith('postgres')) {
  console.error('SUPABASE_DB_URL no parece una cadena Postgres (postgresql://...).');
  process.exit(1);
}

const result = spawnSync(
  'npx',
  [
    '-y',
    'supabase@latest',
    'db',
    'push',
    '--db-url',
    dbUrl,
    '--yes',
    '--workdir',
    rootDir,
  ],
  { stdio: 'inherit', cwd: rootDir },
);

if (result.error) {
  console.error(`No se pudo ejecutar la CLI de Supabase: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
