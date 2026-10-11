import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const work = path.resolve(root, 'Documentation/datasets/Landmark Recognition/landmark_recognition');
const manifestPath = path.join(work, 'review_manifest.csv');
const outputPath = path.join(work, 'vision_label_suggestions.json');
const model = process.env.TAYLOR_VISION_MODEL || 'google/gemini-3.1-flash-lite-image';
const batchSize = Number(process.env.TAYLOR_VISION_BATCH_SIZE || 6);
const delayMs = Number(process.env.TAYLOR_VISION_DELAY_MS || 250);
const allowedSuggestions = [
  'unknown', 'aricc', 'rio', 'fablab', 'caesar', 'recon', 'ovprei', 'olcpd_office',
  'emh_department', 'elevator', 'elevator_4f', 'itso', 'iot_plaque', 'entrance_aricc',
  'entrance_rio', 'entrance_fablab', 'entrance_caesar', 'entrance_ovprei'
];
const allowedSuggestionSet = new Set(allowedSuggestions);

function parseCsv(text) {
  const records = []; let row = []; let cell = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; }
    else if (character === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && text[index + 1] === '\n') index += 1; row.push(cell); if (row.some(Boolean)) records.push(row); row = []; cell = ''; }
    else cell += character;
  }
  if (cell || row.length) { row.push(cell); records.push(row); }
  const headers = records.shift();
  return records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(candidate);
}

function normalizeResult(item, frame) {
  const label = allowedSuggestionSet.has(item?.suggested_label) ? item.suggested_label : 'unknown';
  const confidence = ['high', 'medium', 'low', 'uncertain'].includes(item?.confidence) ? item.confidence : 'uncertain';
  const evidence = typeof item?.visual_evidence === 'string' ? item.visual_evidence.trim() : '';
  const reason = typeof item?.reason === 'string' ? item.reason.trim() : '';
  const suitable = label !== 'unknown' && confidence === 'high' && Boolean(evidence) && item?.training_suitable === true;
  return {
    manifest_index: frame.manifest_index,
    frame_path: frame.frame_path,
    source_video: frame.source_video,
    timestamp_seconds: frame.timestamp_seconds,
    suggested_label: label,
    visual_evidence: evidence || 'The model did not provide sufficient visual evidence.',
    confidence,
    review_status: 'ai_suggested_pending_human_review',
    training_suitable: suitable,
    reason: reason || 'Insufficient or uncertain visual evidence; human review required.',
    model
  };
}

async function imagePart(frame) {
  const file = path.resolve(work, '..', frame.frame_path);
  const bytes = await readFile(file);
  return { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${bytes.toString('base64')}` } };
}

async function analyzeBatch(frames) {
  const content = [{ type: 'text', text: [
    'Inspect each attached indoor video frame visually. Use pixels only; do not infer labels from filenames, timestamps, route order, or prior documentation.',
    `Return one JSON object with key "frames", containing one result for every frame_id: ${frames.map((frame) => frame.manifest_index).join(', ')}.`,
    `Allowed suggested_label values: ${allowedSuggestions.join(', ')}. Use unknown when a sign, plaque, entrance, or distinctive landmark is not clearly visible.`,
    'Never label generic corridors, walls, ordinary doors, plants, stairs, or transitions as a department or center.',
    'Use high confidence only when the landmark identity is directly readable or visually distinctive. Set training_suitable true only for a stable physical landmark view with strong evidence; otherwise false.',
    'Each result must have: frame_id, suggested_label, visual_evidence, confidence (high|medium|low|uncertain), training_suitable (boolean), reason.'
  ].join('\n') }];
  for (const frame of frames) content.push({ type: 'text', text: `frame_id=${frame.manifest_index}; source=${frame.source_video}; timestamp=${frame.timestamp_seconds}s` }, await imagePart(frame));
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'http://localhost:4178', 'X-Title': 'TAYLOR landmark visual review' },
    body: JSON.stringify({ model, temperature: 0, max_tokens: 2200, messages: [{ role: 'user', content }], response_format: { type: 'json_object' } })
  });
  if (!response.ok) throw new Error(`Vision API ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const text = payload.choices?.[0]?.message?.content;
  if (!text) throw new Error('Vision API returned no text content.');
  const parsed = extractJson(text);
  const byId = new Map((parsed.frames || []).map((item) => [Number(item.frame_id), item]));
  return frames.map((frame) => normalizeResult(byId.get(frame.manifest_index), frame));
}

const rows = parseCsv(await readFile(manifestPath, 'utf8')).map((row, manifest_index) => ({ ...row, manifest_index }));
const limit = Number(process.argv[2] || rows.length);
const selected = rows.slice(0, limit);
const results = [];
for (let start = 0; start < selected.length; start += batchSize) {
  const batch = selected.slice(start, start + batchSize);
  try { results.push(...await analyzeBatch(batch)); }
  catch (error) {
    results.push(...batch.map((frame) => normalizeResult({ confidence: 'uncertain', reason: `Vision analysis failed: ${error.message}` }, frame)));
  }
  if (start + batchSize < selected.length) await new Promise((resolve) => setTimeout(resolve, delayMs));
  console.log(`Analyzed ${Math.min(start + batchSize, selected.length)}/${selected.length}`);
}

const output = {
  status: selected.length === rows.length ? 'complete' : 'partial_validation_run',
  analysis_type: 'actual_image_frame_analysis',
  vision_model: model,
  source_manifest: 'review_manifest.csv',
  source_review_notes_used: false,
  source_videos_available: new Set(rows.map((row) => row.source_video)).size,
  frames_available: rows.length,
  frames_analyzed: results.length,
  counts: {
    confident_suggestions: results.filter((item) => item.confidence === 'high' && item.suggested_label !== 'unknown').length,
    uncertain_frames: results.filter((item) => item.suggested_label === 'unknown' || item.confidence !== 'high').length,
    training_suitable_candidates: results.filter((item) => item.training_suitable).length
  },
  policy: { suggestions_do_not_change_manifest: true, human_approval_required: true, route_cues_and_generic_views_rejected: true },
  suggestions: results
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output: outputPath, ...output.counts }, null, 2));