import centerRecords from '../../data/bulsu-centers.records.json' with { type: 'json' };

export const LOCAL_KNOWLEDGE_SCHEMA_VERSION = 1;
export const LOCAL_KNOWLEDGE_VERSION = 'bulsu-centers-20261009-v1';
export const LOCAL_KNOWLEDGE_DB_NAME = 'taylor-local-knowledge';
export const LOCAL_KNOWLEDGE_STORE_NAME = 'indexes';
export const LOCAL_KNOWLEDGE_KEY = 'bulsu-centers';

const ENTITY_ALIASES = Object.freeze({
  ARICC: ['ARICC', 'ARIC Center', 'Advanced Robotics and Intelligent Control Center'],
  RIO: ['RIO', 'Research and Innovation Office'],
  CAESAR: ['CAESAR', 'Center for Advanced Environmental Science and Agriculture Research'],
  CBS: ['CBS', 'Center for Bulacan Studies', 'Bahay Saliksikan ng Bulacan'],
  FABLAB: ['FABLAB', 'BulSU Fablab', 'Center for Fabrication and Manufacture'],
  'BARAS TBI': ['BARAS TBI', 'BARAS', 'DOST-BulSU BARAS Technology Business Incubator'],
  FIC: ['FIC', 'Food Innovation Center', 'Regional Food Innovation Center'],
  RECON: ['RECON', 'RECON Center', 'Resiliency Energy Continuity Center'],
  RIO_PENDING: ['RIO', 'Research and Innovation Office'],
});

const INTENT_SECTIONS = Object.freeze({
  services: ['services', 'technical_services', 'research_and_development', 'laboratory_and_technical_services', 'additive_manufacturing', 'subtractive_and_other_services', 'programs'],
  facilities: ['additive_manufacturing', 'subtractive_and_other_services', 'stakeholders', 'laboratory_and_technical_services'],
  location: ['overview', 'regional_context', 'vision_mission_goals', 'stakeholders'],
  focus: ['technology_focus', 'mission_vision_focus_areas', 'research_and_development', 'programs', 'recent_projects', 'overview'],
  overview: ['overview', 'about', 'vision_mission_goals', 'mission_vision_focus_areas', 'regional_context'],
});

const STOP_WORDS = new Set(['what', 'is', 'the', 'a', 'an', 'tell', 'me', 'about', 'does', 'do', 'offer', 'offers', 'and', 'or', 'how', 'where', 'can', 'who', 'are', 'for', 'of', 'to', 'in', 'with', 'available', 'please', 'center', 'university']);

function normalize(value = '') {
  return String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(value) {
  return normalize(value).split(/\s+/).filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function entityFromText(value = '') {
  const normalized = normalize(value);
  return Object.entries(ENTITY_ALIASES)
    .filter(([entity]) => !entity.endsWith('_PENDING'))
    .sort(([, left], [, right]) => Math.max(...right.map((alias) => normalize(alias).length)) - Math.max(...left.map((alias) => normalize(alias).length)))
    .find(([, aliases]) => aliases.some((alias) => normalized.includes(normalize(alias))))?.[0] || '';
}

function getIntent(query) {
  const normalized = normalize(query);
  if (/\bwhere|location|located|building|floor|campus|address\b/.test(normalized)) return 'location';
  if (/\bservice|services|offer|offers|provide|support|training|workshop|equipment|facility|facilities|use\b/.test(normalized)) return 'services';
  if (/\bfocus|research|project|projects|work|mission|vision|program|programs\b/.test(normalized)) return 'focus';
  return 'overview';
}

function buildEntityIndex(records) {
  const entities = {};
  for (const record of records) {
    if (!record?.entity || !record?.content || !record?.source || !record?.id) continue;
    const existing = entities[record.entity] || {
      entity: record.entity,
      fullName: record.full_name,
      aliases: [...(record.aliases || [])],
      institution: record.institution,
      category: record.category,
      records: [],
      sources: new Set(),
      locations: {},
    };
    existing.aliases = [...new Set([...existing.aliases, ...(record.aliases || [])])];
    existing.records.push({
      id: record.id,
      section: record.section,
      content: record.content,
      source: record.source,
      sourceType: record.source_type,
      updatedAt: record.updatedAt || null,
      location: Object.fromEntries(['campus', 'building', 'floor', 'city', 'province'].filter((key) => record[key] !== undefined).map((key) => [key, record[key]])),
    });
    existing.sources.add(record.source);
    for (const key of ['campus', 'building', 'floor', 'city', 'province']) {
      if (record[key] !== undefined) existing.locations[key] = record[key];
    }
    entities[record.entity] = existing;
  }
  return Object.fromEntries(Object.entries(entities).map(([entity, value]) => [entity, {
    ...value,
    sources: [...value.sources],
    recordCount: value.records.length,
  }]));
}

export function createKnowledgeIndex(records = centerRecords, now = new Date().toISOString()) {
  const entities = buildEntityIndex(records);
  return {
    schemaVersion: LOCAL_KNOWLEDGE_SCHEMA_VERSION,
    knowledgeVersion: LOCAL_KNOWLEDGE_VERSION,
    updatedAt: now,
    source: 'data/bulsu-centers.records.json',
    sourceType: 'official_center_material',
    recordCount: records.length,
    entityCount: Object.keys(entities).length,
    entities,
  };
}

function scoreEntity(entity, queryTokens, query, activeEntity) {
  const haystack = tokens([entity.entity, entity.fullName, ...entity.aliases].join(' '));
  const queryText = normalize(query);
  const exact = entity.entity === entityFromText(query) || entity.entity === entityFromText(activeEntity);
  const matched = queryTokens.filter((token) => haystack.includes(token)).length;
  const phrase = entity.aliases.some((alias) => queryText.includes(normalize(alias)));
  return (exact ? 10 : 0) + (phrase ? 6 : 0) + matched;
}

function answerForEntity(entity, query, intent) {
  const allowedSections = new Set(INTENT_SECTIONS[intent]);
  const relevant = entity.records.filter((record) => allowedSections.has(record.section));
  if (intent === 'location') {
    const locationRecords = entity.records.filter((record) => Object.keys(record.location).length > 0);
    if (locationRecords.length === 0 && Object.keys(entity.locations).length === 0) return null;
    const location = Object.entries(entity.locations).map(([key, value]) => `${key}: ${value}`).join(', ');
    return {
      text: `${entity.entity} is listed at ${location}.`,
      sourceIds: locationRecords.map((record) => record.id),
      sources: [...new Set(locationRecords.map((record) => record.source))],
      intent,
    };
  }
  if (relevant.length === 0) return null;
  const selected = relevant.slice(0, intent === 'overview' ? 2 : 3);
  const prefix = intent === 'overview'
    ? `${entity.entity} (${entity.fullName}) is described as follows:`
    : `${entity.entity} information about ${intent}:`;
  return {
    text: `${prefix} ${selected.map((record) => record.content).join(' ')}`,
    sourceIds: selected.map((record) => record.id),
    sources: [...new Set(selected.map((record) => record.source))],
    intent,
  };
}

export function searchLocalKnowledge(query, { activeEntity = '', index = createKnowledgeIndex() } = {}) {
  const text = String(query || '').trim();
  if (!text) return { match: null, reason: 'empty-query', latencyMs: 0 };
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const requestedEntity = entityFromText(text) || entityFromText(activeEntity);
  const queryTokens = tokens(text);
  const candidates = Object.values(index.entities)
    .map((entity) => ({ entity, score: scoreEntity(entity, queryTokens, text, activeEntity) }))
    .filter(({ entity, score }) => score > 0 && (!requestedEntity || entity.entity === requestedEntity))
    .sort((left, right) => right.score - left.score);
  if (candidates.length === 0) return { match: null, reason: requestedEntity ? 'entity-not-indexed' : 'entity-not-found', entity: requestedEntity, latencyMs: elapsed(started) };
  const intent = getIntent(text);
  const candidate = candidates[0];
  const answer = answerForEntity(candidate.entity, text, intent);
  if (!answer || candidate.score < (requestedEntity ? 6 : 3)) return { match: null, reason: 'insufficient-local-evidence', entity: candidate.entity, intent, latencyMs: elapsed(started) };
  return {
    match: { ...answer, entity: candidate.entity.entity, confidence: Math.min(1, candidate.score / 16), knowledgeVersion: index.knowledgeVersion },
    latencyMs: elapsed(started),
  };
}

function elapsed(started) {
  const current = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return Math.max(0, Math.round(current - started));
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_KNOWLEDGE_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(LOCAL_KNOWLEDGE_STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveKnowledgeIndex(index, dbOverride) {
  const db = dbOverride || await openDatabase();
  if (!db) return { persisted: false, index };
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(LOCAL_KNOWLEDGE_STORE_NAME, 'readwrite');
    transaction.objectStore(LOCAL_KNOWLEDGE_STORE_NAME).put(index, LOCAL_KNOWLEDGE_KEY);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  return { persisted: true, index };
}

export async function loadKnowledgeIndex(dbOverride) {
  const db = dbOverride || await openDatabase();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const request = db.transaction(LOCAL_KNOWLEDGE_STORE_NAME, 'readonly').objectStore(LOCAL_KNOWLEDGE_STORE_NAME).get(LOCAL_KNOWLEDGE_KEY);
    request.onsuccess = () => {
      const value = request.result;
      resolve(value?.schemaVersion === LOCAL_KNOWLEDGE_SCHEMA_VERSION ? value : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function initializeLocalKnowledge() {
  const persisted = await loadKnowledgeIndex().catch(() => null);
  if (persisted?.knowledgeVersion === LOCAL_KNOWLEDGE_VERSION) return persisted;
  const index = createKnowledgeIndex();
  await saveKnowledgeIndex(index).catch(() => null);
  return index;
}

export function getOfflineUnavailableMessage(entity = '') {
  return entity
    ? `I do not have verified local information for ${entity} about that question. I will not guess.`
    : 'That specific information is not available locally, and the online service is unavailable. I will not guess.';
}

export { ENTITY_ALIASES };
export default { createKnowledgeIndex, searchLocalKnowledge, initializeLocalKnowledge };
