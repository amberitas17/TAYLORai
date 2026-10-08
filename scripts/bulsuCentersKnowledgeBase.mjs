import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline, env } from '@xenova/transformers';
import { Pinecone } from '@pinecone-database/pinecone';

env.allowLocalModels = true;
env.backends.onnx.wasm = true;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_RECORDS_PATH = path.resolve(__dirname, '../data/bulsu-centers.records.json');
export const DEFAULT_PINECONE_NAMESPACE = process.env.PINECONE_BULSU_NAMESPACE || 'bulsu-centers';
export const DEFAULT_PINECONE_INDEX = process.env.PINECONE_INDEX || 'taylor-knowledge';
export const DEFAULT_TOP_K = 5;
export const BULSU_VECTOR_DIMENSION = 1024;
export const BULSU_GROUNDED_SYSTEM_PROMPT = `You are TAYLOR, an AI assistant for Bulacan State University.

For questions about BulSU centers, use the supplied knowledge-base context as the factual source.
Answer using retrieved context when sufficient. Do not invent services, facilities, locations, contact information, research programs, or organizational details that are absent from the retrieved context. If the knowledge base does not contain enough information, clearly state that the available center information does not provide the requested detail.`;
export const BULSU_CENTER_ENTITIES = Object.freeze({
  ARICC: ['ARICC', 'Advanced Robotics and Intelligent Control Center', 'ARIC Center'],
  RIO: ['RIO', 'Research and Innovation Office'],
  CAESAR: ['CAESAR', 'Center for Advanced Environmental Science and Agriculture Research'],
  CBS: ['CBS', 'Center for Bulacan Studies', 'Bahay Saliksikan ng Bulacan'],
  FABLAB: ['FABLAB', 'Center for Fabrication and Manufacture', 'BulSU Fablab', 'Bulacan State University FabLab'],
  'BARAS TBI': ['BARAS TBI', 'DOST-BulSU BARAS Technology Business Incubator', 'Business Assistance for Research Acceleration and Sustainability'],
  FIC: ['FIC', 'Food Innovation Center', 'Regional Food Innovation Center'],
  RECON: ['RECON', 'Resiliency Energy Continuity Center', 'RECON Center'],
});

let embeddingPipeline = null;

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function normalizeBulsuEntity(value = '') {
  const query = normalizeText(value).toLowerCase();
  if (!query) return '';
  return Object.entries(BULSU_CENTER_ENTITIES).find(([, aliases]) => aliases.some((alias) => query === alias.toLowerCase() || query.includes(alias.toLowerCase())))?.[0] || '';
}

export function isBulsuCenterQuestion(message = '', activeEntity = '') {
  const text = normalizeText(message);
  return Boolean(normalizeBulsuEntity(activeEntity) || normalizeBulsuEntity(text) || /BulSU|Bulacan State University|BARAS TBI|Food Innovation Center|RECON Center|ARIC Center/i.test(text));
}

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) embeddingPipeline = await pipeline('feature-extraction', 'Xenova/bge-m3');
  return embeddingPipeline;
}

export async function embedBulsuText(text) {
  const extractor = await getEmbeddingPipeline();
  const output = await extractor(normalizeText(text), { pooling: 'mean', normalize: true });
  const vector = Array.isArray(output?.data)
    ? Array.from(output.data)
    : Array.isArray(output?.[0])
      ? output[0]
      : output?.[0]?.data ? Array.from(output[0].data) : [];
  if (!vector.length) throw new Error('Embedding output was empty.');
  return vector;
}

export async function readBulsuCenterRecords(recordsPath = DEFAULT_RECORDS_PATH) {
  const content = await fs.readFile(path.resolve(recordsPath), 'utf8');
  const records = JSON.parse(content);
  if (!Array.isArray(records)) throw new TypeError('BulSU center records must be an array.');
  return records;
}

export function buildVectorMetadata(record) {
  const metadata = {
    entity: record.entity,
    aliases: (record.aliases || []).join(' | '),
    full_name: record.full_name,
    institution: record.institution,
    category: record.category,
    section: record.section,
    source: record.source,
    source_type: record.source_type,
    campus: record.campus,
    content: record.content,
  };
  for (const field of ['building', 'floor', 'city', 'province']) {
    if (record[field] !== undefined) metadata[field] = record[field];
  }
  return metadata;
}

export async function buildBulsuVectors(records = []) {
  const vectors = [];
  for (const record of records) {
    const values = await embedBulsuText(`${record.entity} ${record.full_name} ${record.section}. ${record.content}`);
    if (values.length !== BULSU_VECTOR_DIMENSION || values.some((value) => !Number.isFinite(value))) {
      throw new Error(`Invalid embedding for ${record.id}: expected ${BULSU_VECTOR_DIMENSION} finite values, received ${values.length}.`);
    }
    vectors.push({ id: record.id, values, metadata: buildVectorMetadata(record) });
  }
  return vectors;
}

function getPineconeClient(options = {}) {
  const apiKey = options.apiKey || process.env.PINECONE_API_KEY;
  if (!apiKey) throw new Error('PINECONE_API_KEY is not configured.');
  return new Pinecone({ apiKey });
}

export async function indexBulsuCenters(options = {}) {
  const records = options.records || await readBulsuCenterRecords(options.recordsPath);
  if (records.length !== 26) throw new Error(`Expected 26 BulSU records, received ${records.length}.`);
  const probe = await embedBulsuText('What is ARICC?');
  if (probe.length !== BULSU_VECTOR_DIMENSION || probe.some((value) => !Number.isFinite(value))) {
    throw new Error(`Runtime embedding mismatch: expected ${BULSU_VECTOR_DIMENSION} finite values, received ${probe.length}.`);
  }
  const vectors = await buildBulsuVectors(records);
  const indexName = options.indexName || process.env.PINECONE_INDEX || DEFAULT_PINECONE_INDEX;
  const namespace = options.namespace || process.env.PINECONE_BULSU_NAMESPACE || DEFAULT_PINECONE_NAMESPACE;
  const index = getPineconeClient(options).index({ name: indexName, namespace });
  for (let start = 0; start < vectors.length; start += 50) {
    await index.upsert({ records: vectors.slice(start, start + 50) });
  }
  return { indexed: vectors.length, failed: 0, indexName, namespace, embeddingModel: 'Xenova/bge-m3', dimension: vectors[0]?.values.length || 0 };
}

function lexicalSearch(records, query, activeEntity, topK) {
  const normalizedQuery = normalizeText(query).toLowerCase();
  const entity = normalizeBulsuEntity(activeEntity) || normalizeBulsuEntity(query);
  const terms = normalizedQuery.split(/\s+/).filter((term) => term.length > 2);
  return records
    .filter((record) => !entity || record.entity === entity)
    .map((record) => {
      const haystack = `${record.entity} ${(record.aliases || []).join(' ')} ${record.full_name} ${record.section} ${record.content}`.toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0) + (entity && record.entity === entity ? 3 : 0);
      return { score, ...record };
    })
    .filter((record) => record.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function searchBulsuCenters(query, options = {}) {
  const topK = Number(options.topK || DEFAULT_TOP_K);
  const activeEntity = normalizeBulsuEntity(options.activeEntity);
  const entity = normalizeBulsuEntity(query) || activeEntity;
  const indexName = options.indexName || process.env.PINECONE_INDEX || DEFAULT_PINECONE_INDEX;
  const namespace = options.namespace || process.env.PINECONE_BULSU_NAMESPACE || DEFAULT_PINECONE_NAMESPACE;

  try {
    const vector = await embedBulsuText(query);
    const index = getPineconeClient(options).index({ name: indexName, namespace });
    const result = await index.query({
      vector,
      topK,
      includeMetadata: true,
      ...(entity ? { filter: { entity: { $eq: entity } } } : {}),
    });
    return (result.matches || []).map((match) => ({
      id: match.id,
      score: match.score,
      ...match.metadata,
    }));
  } catch (error) {
    if (options.requirePinecone) throw error;
    const records = options.records || await readBulsuCenterRecords(options.recordsPath);
    return lexicalSearch(records, query, entity, topK);
  }
}

export function formatBulsuContext(results = []) {
  return results.map((item) => [
    `Entity: ${item.entity}`,
    `Full name: ${item.full_name}`,
    `Section: ${item.section}`,
    `Source: ${item.source}`,
    `Content: ${item.content}`,
  ].join('\n')).join('\n\n');
}
