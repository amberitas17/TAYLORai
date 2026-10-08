import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = path.join(root, 'Documentation/datasets/Landmark Recognition/landmark_recognition');
const reviewRoot = path.join(work, 'review_interface');
const manifestPath = path.join(work, 'review_manifest.csv');
const suggestionsPath = path.join(work, 'label_suggestions.json');
const visionSuggestionsPath = path.join(work, 'vision_label_suggestions.json');
const localOcrSuggestionsPath = path.join(work, 'local_ocr_suggestions.json');
const visualGroupsPath = path.join(work, 'visual_similarity_groups.json');
const labelsPath = path.join(work, 'landmark_labels.json');
const labels = new Set(JSON.parse(await readFile(labelsPath, 'utf8')).labels);
const fields = ['frame_path', 'source_video', 'source_type', 'frame_index', 'timestamp_seconds', 'label', 'review_status', 'split', 'review_notes'];

function parseCsv(text) {
  const records = []; let row = []; let cell = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) { const character = text[index];
    if (character === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; }
    else if (character === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && text[index + 1] === '\n') index += 1; row.push(cell); if (row.some(Boolean)) records.push(row); row = []; cell = ''; }
    else cell += character;
  }
  if (cell || row.length) { row.push(cell); records.push(row); } const headers = records.shift();
  return records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}
function csvCell(value) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function stringify(rows) { return `${fields.join(',')}\n${rows.map((row) => fields.map((field) => csvCell(row[field])).join(',')).join('\n')}\n`; }
function sessionManifest(url) {
  const session = String(url.searchParams.get('session') || '').trim().toLowerCase();
  if (!session) return manifestPath;
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(session)) throw new Error('Invalid session id');
  return path.join(work, 'incoming_landmark_sessions', session, 'review_manifest.csv');
}
async function manifest(file = manifestPath) { return parseCsv(await readFile(file, 'utf8')); }
async function suggestions(file = manifestPath) {
  const rows = await manifest(file);
  if (file !== manifestPath) return { suggestions: rows.map((row, index) => ({ manifest_index: index, frame_path: row.frame_path, source_video: row.source_video, timestamp_seconds: row.timestamp_seconds, suggested_label: 'unknown', confidence: 'none', review_status: 'needs_review', training_suitable: false, reason: 'New recording requires human confirmation.' })) };
  const localOcr = JSON.parse(await readFile(localOcrSuggestionsPath, 'utf8').catch(() => 'null'));
  if (localOcr) return localOcr;
  const vision = JSON.parse(await readFile(visionSuggestionsPath, 'utf8').catch(() => 'null'));
  if (!vision) return JSON.parse(await readFile(suggestionsPath, 'utf8'));
  const byIndex = new Map((vision.suggestions || []).map((item) => [item.manifest_index, item]));
  return {
    ...vision,
    suggestions: rows.map((row, index) => byIndex.get(index) || {
      manifest_index: index, frame_path: row.frame_path, source_video: row.source_video,
      timestamp_seconds: row.timestamp_seconds, suggested_label: 'unknown',
      visual_evidence: 'This frame has not been analyzed because the vision run is incomplete.',
      confidence: 'uncertain', review_status: 'needs_review', training_suitable: false,
      reason: 'Awaiting a successful vision-analysis run.'
    })
  };
}
async function groups(file = visualGroupsPath) { return file === visualGroupsPath ? JSON.parse(await readFile(file, 'utf8')) : { groups: [] }; }
function normalizeLabel(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64); }
async function jsonBody(request) { let body = ''; for await (const chunk of request) body += chunk; return JSON.parse(body || '{}'); }
function send(response, status, body, type = 'application/json') { response.writeHead(status, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' }); response.end(type === 'application/json' ? JSON.stringify(body) : body); }
function safeJoin(base, relative) { const resolved = path.resolve(base, relative); return resolved.startsWith(`${base}${path.sep}`) ? resolved : null; }

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/api/manifest') return send(response, 200, await manifest(sessionManifest(url)));
    if (request.method === 'GET' && url.pathname === '/api/suggestions') return send(response, 200, await suggestions(sessionManifest(url)));
    if (request.method === 'GET' && url.pathname === '/api/groups') return send(response, 200, await groups(url.searchParams.has('session') ? null : visualGroupsPath));
    if (request.method === 'GET' && url.pathname === '/api/labels') return send(response, 200, [...labels]);
    if (request.method === 'POST' && url.pathname === '/api/labels') {
      const payload = await jsonBody(request); const label = normalizeLabel(payload.label);
      if (!label || label === 'unknown') return send(response, 400, { error: 'Enter a non-empty label other than unknown.' });
      if (labels.has(label)) return send(response, 409, { error: 'That label already exists.', label });
      labels.add(label); await writeFile(labelsPath, `${JSON.stringify({ labels: [...labels] }, null, 2)}\n`, 'utf8'); return send(response, 201, { label, labels: [...labels] });
    }
    if (request.method === 'POST' && url.pathname === '/api/review') {
      const payload = await jsonBody(request); const targetManifest = sessionManifest(url); const rows = await manifest(targetManifest); const indexes = [...new Set((payload.indexes || []).map(Number))].filter((index) => Number.isInteger(index) && rows[index]); const label = payload.action === 'reject' ? 'unknown' : payload.label;
      if (!labels.has(label)) return send(response, 400, { error: 'Invalid label' }); if (payload.split && !['train', 'val'].includes(payload.split)) return send(response, 400, { error: 'Invalid split' });
      const sourceVideos = new Set(indexes.map((index) => rows[index].source_video));
      for (const index of indexes) { rows[index].label = label; rows[index].review_status = 'reviewed'; rows[index].review_notes = payload.action === 'reject' ? `[rejected] ${payload.notes || 'Reviewer rejected this frame.'}` : (payload.notes || 'Approved by reviewer.'); }
      if (payload.split) for (const row of rows) if (sourceVideos.has(row.source_video)) row.split = payload.split;
      await writeFile(targetManifest, stringify(rows), 'utf8'); return send(response, 200, { updated: indexes.length, rows });
    }
    if (request.method === 'POST' && url.pathname === '/api/group-review') {
      if (url.searchParams.has('session')) return send(response, 400, { error: 'Visual groups are not generated for new sessions yet; review frames individually.' });
      const payload = await jsonBody(request);
      if (payload.confirm !== true) return send(response, 400, { error: 'Explicit confirmation is required for group review.' });
      const dataset = await groups(); const group = dataset.groups.find((item) => item.group_id === payload.group_id);
      if (!group) return send(response, 404, { error: 'Group not found' });
      const rows = await manifest(); const indexes = group.manifest_indexes.map(Number).filter((index) => Number.isInteger(index) && rows[index]);
      if (!indexes.length || new Set(indexes.map((index) => rows[index].source_video)).size !== 1) return send(response, 400, { error: 'Group must contain one source video.' });
      const action = payload.action === 'reject' ? 'reject' : payload.action === 'correct' ? 'correct' : 'approve';
      const label = action === 'reject' ? 'unknown' : payload.label;
      if (!labels.has(label)) return send(response, 400, { error: 'A valid reviewer label is required.' });
      for (const index of indexes) {
        rows[index].label = label; rows[index].review_status = 'reviewed';
        rows[index].review_notes = action === 'reject' ? `[group rejected] ${payload.notes || 'Reviewer rejected this group.'}` : `[group ${action}] ${payload.notes || 'Reviewer confirmed this group.'}`;
      }
      await writeFile(manifestPath, stringify(rows), 'utf8'); return send(response, 200, { updated: indexes.length, group_id: group.group_id, rows });
    }
    if (request.method === 'GET' && url.pathname.startsWith('/frame/')) { const relative = decodeURIComponent(url.pathname.slice('/frame/'.length)); const file = safeJoin(path.dirname(work), relative); if (!file || !(await stat(file).catch(() => null))) return send(response, 404, { error: 'Frame not found' }); const type = path.extname(file).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg'; response.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=3600' }); return response.end(await readFile(file)); }
    const requested = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/review\/?/, ''); const file = safeJoin(reviewRoot, requested); if (!file || !(await stat(file).catch(() => null))) return send(response, 404, 'Not found', 'text/plain'); const extension = path.extname(file).toLowerCase(); const type = extension === '.js' ? 'text/javascript' : extension === '.css' ? 'text/css' : 'text/html'; return send(response, 200, await readFile(file, 'utf8'), type);
  } catch (error) { return send(response, 500, { error: error.message }); }
});
const port = Number(process.env.PORT || 4178); server.listen(port, '127.0.0.1', () => console.log(`Landmark review: http://127.0.0.1:${port}`));