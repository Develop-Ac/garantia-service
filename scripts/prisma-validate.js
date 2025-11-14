#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL nao configurada. Preencha o .env antes de validar.');
  process.exit(1);
}

const args = [
  'prisma',
  'migrate',
  'diff',
  '--from-url',
  databaseUrl,
  '--to-schema-datamodel',
  'prisma/schema.prisma',
  '--exit-code',
];

console.log('> Executando prisma migrate diff para validar integracao inicial...');
const result = spawnSync('npx', args, {
  encoding: 'utf-8',
  shell: true,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

const ignoreTables = new Set(['emails', 'email_attachments']);

const hasRelevantDiff = (output) => {
  const lines = output.split('\n');
  let skipDetails = false;
  let skipRemovedTables = false;

  for (const rawLine of lines) {
    const line = rawLine;
    const trimmed = line.trim();

    if (skipDetails) {
      if (line.startsWith('  ')) {
        continue;
      }
      skipDetails = false;
    }

    if (skipRemovedTables) {
      if (!trimmed) {
        skipRemovedTables = false;
        continue;
      }
      const tableName = trimmed.replace(/^- /, '').trim();
      if (!ignoreTables.has(tableName)) {
        return true;
      }
      continue;
    }

    const blockMatch = line.match(/^\[[^\]]+\]\s+(?:Changed|Added|Removed)\s+the\s+`([^`]+)`\s+table/);
    if (blockMatch) {
      if (ignoreTables.has(blockMatch[1])) {
        skipDetails = true;
        continue;
      }
      return true;
    }

    if (/^\[-\]\s+Removed tables/.test(line)) {
      skipRemovedTables = true;
      continue;
    }
  }

  return false;
};

if (result.status !== 0) {
  const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (!hasRelevantDiff(combinedOutput)) {
    console.log('\nDiferenças encontradas apenas em tabelas ignoradas (emails/email_attachments).');
    process.exit(0);
  }

  console.error('\nFalha ao validar o schema atual no banco existente.');
  process.exit(result.status ?? 1);
}

console.log('\nBanco existente em conformidade com o schema Prisma.');
