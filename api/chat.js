import dotenv from 'dotenv';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import process from 'node:process';
import bulsuRecords from '../data/bulsu-centers.records.json' with { type: 'json' };

dotenv.config();

const BULSU_GROUNDED_SYSTEM_PROMPT = `You are TAYLOR, an AI assistant for Bulacan State University.\n\nFor questions about BulSU centers, use the supplied knowledge-base context as the factual source. Do not invent services, facilities, locations, contact information, research programs, or organizational details that are absent from the supplied context.`;
const SYSTEM_PROMPT = `${BULSU_GROUNDED_SYSTEM_PROMPT}\n\nYou assist visitors with academic programs, student services, enrollment, scholarships, research and innovation, and campus facilities. Always respond as TAYLOR, be professional, welcoming, concise, and helpful.`;
const BULSU_ENTITIES = ['ARICC', 'RIO', 'CAESAR', 'CBS', 'FABLAB', 'BARAS TBI', 'FIC', 'RECON'];
const BULSU_VECTOR_DIMENSION = 1024;
const DEFAULT_TOP_K = 5;
const DEFAULT_RELEVANCE_THRESHOLD = 0.35;
const DEFAULT_EMBEDDING_MODEL = 'Xenova/bge-m3';
let pineconeClient;

function normalizeBulsuEntity(value = '') {
  const text = String(value).toLowerCase();
  return BULSU_ENTITIES.find((entity) => text.includes(entity.toLowerCase())) || '';
}

function isBulsuCenterQuestion(message = '', activeEntity = '') {
  return Boolean(normalizeBulsuEntity(message) || normalizeBulsuEntity(activeEntity) || /bulsu|bulacan state university|university|center|research|innovation|facility|program/i.test(message));
}

function searchBulsuCenters(query, activeEntity = '') {
  const entity = normalizeBulsuEntity(query) || normalizeBulsuEntity(activeEntity);
  const terms = String(query).toLowerCase().split(/\s+/).filter((term) => term.length > 2);
  return bulsuRecords
    .filter((record) => !entity || record.entity === entity)
    .map((record) => {
      const haystack = `${record.entity} ${(record.aliases || []).join(' ')} ${record.full_name} ${record.section} ${record.content}`.toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0) + (entity && record.entity === entity ? 3 : 0);
      return { score, ...record };
    })
    .filter((record) => record.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function formatBulsuContext(results = []) {
  return results.map((item) => [
    `Entity: ${item.entity}`,
    `Full name: ${item.full_name}`,
    `Section: ${item.section}`,
    `Source: ${item.source}`,
    `Content: ${item.content}`,
  ].join('\n')).join('\n\n');
}

function normalizeVector(values) {
  const vector = values.map(Number);
  if (vector.length !== BULSU_VECTOR_DIMENSION || vector.some((value) => !Number.isFinite(value))) {
    throw new Error(`Embedding must contain ${BULSU_VECTOR_DIMENSION} finite values.`);
  }
  const magnitude = Math.sqrt(vector.reduce((total, value) => total + (value * value), 0));
  if (!magnitude) throw new Error('Embedding vector was empty.');
  return vector.map((value) => value / magnitude);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function embedBulsuQuery(text) {
  const token = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
  if (!token) throw new Error('Hosted embedding credentials are not configured.');
  const model = process.env.BULSU_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const response = await fetchWithTimeout(`https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
  }, Number(process.env.BULSU_EMBEDDING_TIMEOUT_MS || 8000));
  if (!response.ok) throw new Error(`Hosted embedding request failed with HTTP ${response.status}.`);
  const payload = await response.json();
  const output = Array.isArray(payload?.[0]) && Array.isArray(payload[0][0]) ? payload[0] : payload;
  const values = Array.isArray(output?.[0])
    ? output.reduce((pooled, tokenVector) => tokenVector.map((value, index) => pooled[index] + Number(value)), Array(BULSU_VECTOR_DIMENSION).fill(0)).map((value) => value / output.length)
    : output;
  if (!Array.isArray(values)) throw new Error('Hosted embedding response was not an array.');
  return normalizeVector(values);
}

function getPineconeIndex() {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) throw new Error('Pinecone credentials are not configured.');
  pineconeClient ||= new Pinecone({ apiKey });
  return pineconeClient.index({
    name: process.env.PINECONE_INDEX || 'taylor',
    namespace: process.env.PINECONE_BULSU_NAMESPACE || 'bulsu-centers',
  });
}

async function semanticSearchBulsuCenters(query, activeEntity = '') {
  const vector = await embedBulsuQuery(query);
  const entity = normalizeBulsuEntity(query) || normalizeBulsuEntity(activeEntity);
  const result = await getPineconeIndex().query({
    vector,
    topK: Number(process.env.BULSU_TOP_K || DEFAULT_TOP_K),
    includeMetadata: true,
    ...(entity ? { filter: { entity: { $eq: entity } } } : {}),
  });
  const threshold = Number(process.env.BULSU_RELEVANCE_THRESHOLD || DEFAULT_RELEVANCE_THRESHOLD);
  return (result.matches || [])
    .filter((match) => Number(match.score) >= threshold)
    .map((match) => ({ id: match.id, score: match.score, ...match.metadata }));
}

async function retrieveBulsuCenters(query, activeEntity = '') {
  try {
    const semantic = await semanticSearchBulsuCenters(query, activeEntity);
    return { results: semantic, retrievalMode: 'semantic' };
  } catch (error) {
    console.warn('[chat] semantic retrieval unavailable; using lexical fallback', error?.message || error);
    return { results: searchBulsuCenters(query, activeEntity), retrievalMode: 'lexical-fallback' };
  }
}

async function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.text === 'function') {
    try {
      const text = await req.text();
      if (!text) {
        return {};
      }
      return JSON.parse(text);
    } catch (error) {
      console.warn('[chat] unable to parse request text body', error);
      return {};
    }
  }

  return {};
}

function classifyOpenRouterError(error) {
  const status = error?.status || error?.response?.status;
  const code = error?.code || error?.response?.data?.error?.code;
  const message = error?.message || '';

  if (!process.env.OPENROUTER_API_KEY || /api key|invalid_api_key/i.test(message) || code === 'invalid_api_key') {
    return { status: 401, errorType: 'invalid-api-key', message: 'The AI service key is invalid or missing.' };
  }

  if (status === 429 || /rate limit|too many requests/i.test(message)) {
    return { status: 429, errorType: 'rate-limit-exceeded', message: 'The AI service is temporarily rate-limiting requests.' };
  }

  if (status === 404 || /not found/i.test(message)) {
    return { status: 404, errorType: 'api-not-found', message: 'The chat API endpoint could not be found.' };
  }

  if (status >= 500 || /timeout|network|fetch failed|econn|socket/i.test(message)) {
    return { status: 502, errorType: 'backend-unavailable', message: 'The AI service is temporarily unavailable.' };
  }

  return { status: 502, errorType: 'network-error', message: 'A network error prevented the chat request from completing.' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  console.info('[chat] request', {
    method: req.method,
    url: req.url,
    body: req.body,
  });

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, errorType: 'api-not-found', message: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseRequestBody(req);
    const { messages = [], activeEntity = '' } = body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ success: false, errorType: 'backend-unavailable', message: 'messages array is required' });
      return;
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('[chat] missing OPENROUTER_API_KEY');
      res.status(401).json({ success: false, errorType: 'invalid-api-key', message: 'The AI service key is not configured.' });
      return;
    }

    const openrouter = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1', timeout: 15000, maxRetries: 0 });
    const lastUserMessage = [...messages].reverse().find((message) => message?.role === 'user')?.content || '';
    const requestedEntity = normalizeBulsuEntity(lastUserMessage);
    const effectiveActiveEntity = requestedEntity || normalizeBulsuEntity(activeEntity);
    const bulsuRetrieval = isBulsuCenterQuestion(lastUserMessage, effectiveActiveEntity)
      ? await retrieveBulsuCenters(lastUserMessage, effectiveActiveEntity)
      : { results: [], retrievalMode: 'not-requested' };
    const bulsuResults = bulsuRetrieval.results;
    const bulsuContext = formatBulsuContext(bulsuResults);
    if (effectiveActiveEntity === 'RIO' && isBulsuCenterQuestion(lastUserMessage, effectiveActiveEntity) && !bulsuContext) {
      const reply = 'I recognize this as RIO, but detailed RIO information is not yet available in my verified BulSU knowledge base.';
      res.status(200).json({ success: true, reply, activeEntity: 'RIO', usedBulsuContext: false, retrievalMode: bulsuRetrieval.retrievalMode });
      return;
    }
    const completion = await openrouter.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}\n\nWhen a BulSU question has no supplied retrieved evidence, say that the verified knowledge base does not provide enough detail. Do not fill gaps from general knowledge.` },
        ...(bulsuContext ? [{ role: 'system', content: `Answer BulSU questions only from this official BulSU context.\n\n${bulsuContext}` }] : []),
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || 'I am TAYLOR and I am here to assist you.';
    console.info('[chat] success', { replyLength: reply.length });
    res.status(200).json({ success: true, reply, activeEntity: effectiveActiveEntity || '', usedBulsuContext: Boolean(bulsuContext), retrievalMode: bulsuRetrieval.retrievalMode });
  } catch (error) {
    const errorInfo = classifyOpenRouterError(error);
    console.error('[chat] openrouter error', {
      message: error?.message,
      status: error?.status || error?.response?.status,
      code: error?.code || error?.response?.data?.error?.code,
      detail: error?.response?.data || error,
    });
    res.status(errorInfo.status).json({ success: false, errorType: errorInfo.errorType, message: errorInfo.message, details: error?.message || '' });
  }
}
