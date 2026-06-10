import { readFile, writeFile } from 'node:fs/promises';

const rows = JSON.parse(await readFile('scripts/.seed-rows.json', 'utf8'));
const BATCH = 500;
const cols = 'id, version_tag_id, name_ko, name_en, equipment_kind, required_level, required_jobs, requirements, stats, aliases, published_status, source_note';
const sqlLines = [];

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (Array.isArray(v)) {
    if (v.length === 0) return "'{}'";
    return 'ARRAY[' + v.map(s => "'" + s.replace(/'/g, "''") + "'").join(',') + ']';
  }
  if (typeof v === 'object') return "'" + JSON.stringify(v).replace(/'/g, "''") + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const values = batch.map(r => {
    const vals = [r.id, r.version_tag_id, r.name_ko, r.name_en, r.equipment_kind, r.required_level, r.required_jobs, r.requirements, r.stats, r.aliases, r.published_status, r.source_note];
    return '(' + vals.map(esc).join(', ') + ')';
  }).join(',\n');

  sqlLines.push('INSERT INTO public.item_definitions (' + cols + ')\nVALUES\n' + values + '\nON CONFLICT (id) DO UPDATE SET\n  name_ko = EXCLUDED.name_ko,\n  name_en = EXCLUDED.name_en,\n  equipment_kind = EXCLUDED.equipment_kind,\n  required_level = EXCLUDED.required_level,\n  required_jobs = EXCLUDED.required_jobs,\n  requirements = EXCLUDED.requirements,\n  stats = EXCLUDED.stats,\n  aliases = EXCLUDED.aliases,\n  published_status = EXCLUDED.published_status,\n  source_note = EXCLUDED.source_note,\n  updated_at = now();');
}

const sql = sqlLines.join('\n\n') + '\n';
await writeFile('scripts/.seed.sql', sql);
console.log('Generated SQL with ' + sqlLines.length + ' batches for ' + rows.length + ' rows');
console.log('SQL file size: ' + (sql.length / 1024 / 1024).toFixed(1) + ' MB');
