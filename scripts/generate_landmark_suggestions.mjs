import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const work = path.resolve(root, 'Documentation/datasets/Landmark Recognition/landmark_recognition');
const manifestPath = path.join(work, 'review_manifest.csv');
const allowedLabels = new Set([
  'aricc', 'caesar', 'elevator', 'elevator_1f', 'elevator_4f',
  'emh_department', 'entrance_aricc', 'entrance_caesar', 'entrance_fablab',
  'entrance_ovprei', 'entrance_rio', 'fablab', 'hallway_to_aricc',
  'hallway_to_fablab', 'intersection', 'itso', 'olcpd_office', 'ovprei',
  'rio', 'small_opening', 'stairs', 'unknown', 'window_near_bathroom'
]);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted;
    } else if (character === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = '';
    } else cell += character;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift();
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function collectEvidence(value, evidence = [], context = {}) {
  if (!value || typeof value !== 'object') return evidence;
  if (Array.isArray(value)) { value.forEach((item) => collectEvidence(item, evidence, context)); return evidence; }
  const sourceVideo = value.source_video || context.sourceVideo;
  const label = value.proposed_class || value.candidate_id || value.class;
  const range = value.timestamp_range_seconds || (
    Number.isFinite(value.start_timestamp_seconds) && Number.isFinite(value.end_timestamp_seconds)
      ? [value.start_timestamp_seconds, value.end_timestamp_seconds] : null
  );
  const suitability = String(value.classification_suitability || '');
  if (sourceVideo && Array.isArray(range) && range.length === 2 && allowedLabels.has(label)) {
    evidence.push({
      source_video: String(sourceVideo).split(';')[0].trim(), start: Number(range[0]), end: Number(range[1]),
      suggested_label: label, confidence: String(value.confidence || 'medium'),
      evidence: value.visible_evidence || value.what_is_visible || '',
      reason: value.note || (suitability.includes('navigation_cue_only') ? 'Route cue only; requires human review.' : 'Explicit landmark evidence interval.'),
      review_status: value.review_status || 'pending'
    });
  }
  const trainableAsSceneClass = String(value.trainable_as_scene_class || '').toLowerCase();
  if (Array.isArray(value.timestamps) && allowedLabels.has(value.name) && !trainableAsSceneClass.startsWith('no')) {
    for (const timestamp of value.timestamps) {
      const match = String(timestamp).match(/^(.+?):\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
      if (!match) continue;
      evidence.push({
        source_video: match[1].trim(),
        start: Number(match[2]),
        end: Number(match[3]),
        suggested_label: value.name,
        confidence: String(value.confidence || 'medium').split(' ')[0],
        evidence: value.visual_evidence || '',
        reason: value.additional_footage_required || 'Explicit timestamp interval in the landmark master review.',
        review_status: 'pending'
      });
    }
  }
  const nextContext = { sourceVideo: sourceVideo || context.sourceVideo };
  Object.values(value).forEach((child) => collectEvidence(child, evidence, nextContext));
  return evidence;
}

function confidenceRank(value) { return { high: 3, medium_high: 3, medium: 2, low: 1 }[value] || 0; }

const manifest = parseCsv(await readFile(manifestPath, 'utf8'));
const reviewFiles = ['landmark_master_review.json', 'route_aricc_review.json', 'route_rio_review.json', 'route_fablab_review.json', 'route_caesar_review.json', 'route_recon_review.json'];
const evidence = [];
for (const filename of reviewFiles) evidence.push(...collectEvidence(JSON.parse(await readFile(path.join(work, filename), 'utf8'))));

const suggestions = manifest.map((row, index) => {
  const timestamp = Number(row.timestamp_seconds);
  const matches = evidence.filter((item) => item.source_video === row.source_video && Number.isFinite(timestamp) && timestamp >= item.start && timestamp <= item.end)
    .sort((left, right) => confidenceRank(right.confidence) - confidenceRank(left.confidence));
  const best = matches[0];
  if (!best) return {
    manifest_index: index, frame_path: row.frame_path, source_video: row.source_video, timestamp_seconds: row.timestamp_seconds,
    suggested_label: 'unknown', confidence: 'low', review_state: 'needs_review',
    evidence_notes: 'No explicit evidence interval covers this frame; inspect it and keep unknown unless a landmark is unmistakable.',
    reason: 'Generic, transitional, ambiguous, or not covered by the existing evidence review.'
  };
  return {
    manifest_index: index, frame_path: row.frame_path, source_video: row.source_video, timestamp_seconds: row.timestamp_seconds,
    suggested_label: best.suggested_label, confidence: best.confidence, review_state: 'suggested_pending_approval',
    evidence_notes: best.evidence, reason: best.reason, evidence_interval: [best.start, best.end],
    competing_suggestions: matches.slice(1, 3).map((item) => ({ label: item.suggested_label, confidence: item.confidence }))
  };
});

const output = {
  status: 'suggestions_only', generated_at: new Date().toISOString(), source_manifest: 'review_manifest.csv',
  policy: { suggestions_do_not_change_manifest: true, human_approval_required: true, unknown_and_rejected_excluded_from_training: true, source_video_split_is_atomic: true },
  evidence_sources: reviewFiles,
  counts: {
    total: suggestions.length,
    explicit_suggestions: suggestions.filter((item) => item.review_state === 'suggested_pending_approval').length,
    needs_review: suggestions.filter((item) => item.review_state === 'needs_review').length
  },
  suggestions
};
await writeFile(path.join(work, 'label_suggestions.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(output.counts, null, 2));