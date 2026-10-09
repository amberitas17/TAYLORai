import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import OpenAI from 'openai';
import { getFacebookPageContextHint, indexFacebookKnowledgeBase, searchFacebookKnowledgeBase, shouldUseFacebookContext } from './scripts/facebookKnowledgeBase.mjs';
import { BULSU_GROUNDED_SYSTEM_PROMPT, formatBulsuContext, isBulsuCenterQuestion, normalizeBulsuEntity, searchBulsuCenters } from './scripts/bulsuCentersKnowledgeBase.mjs';
import { generateExhibitExplanation } from './scripts/exhibitExplanationService.mjs';

dotenv.config();

const app = express();
const port = process.env.PORT || 3033;

app.use(cors());
app.use(express.json({ limit: '30mb' }));

function learningSyncAuthorized(req) {
  if (req.user?.authenticated === true || req.user?.id) return true;
  const configuredToken = process.env.TAYLOR_LEARNING_SYNC_TOKEN;
  if (!configuredToken) return false;
  const suppliedToken = (req.get('authorization') || '').replace(/^Bearer\s+/i, '') || req.get('x-taylor-sync-token') || '';
  return suppliedToken.length === configuredToken.length && crypto.timingSafeEqual(Buffer.from(suppliedToken), Buffer.from(configuredToken));
}

const INDOOR_MAP_PATH = process.env.TAYLOR_INDOOR_MAP_PATH || path.join(process.cwd(), 'data', 'indoor-maps', 'cit.json');

function defaultIndoorMap() {
  return {
    version: 1,
    building: 'CIT',
    status: 'draft',
    floors: {
      1: { floor: 1, floorPlan: null, landmarks: [], corridors: [] },
      4: { floor: 4, floorPlan: null, landmarks: [], corridors: [] },
    },
    floorConnections: [],
    destinations: [],
    validation: { valid: false, errors: ['Both floor plans must be imported and calibrated.'], warnings: [] },
    updatedAt: null,
    publishedAt: null,
  };
}

async function readIndoorMap() {
  try {
    return JSON.parse(await readFile(INDOOR_MAP_PATH, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return defaultIndoorMap();
    throw error;
  }
}

async function writeIndoorMap(map) {
  await mkdir(path.dirname(INDOOR_MAP_PATH), { recursive: true });
  const temporaryPath = `${INDOOR_MAP_PATH}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(map, null, 2), 'utf8');
  await rename(temporaryPath, INDOOR_MAP_PATH);
}

function adminMapAuthorized(req) {
  const configuredToken = process.env.TAYLOR_INDOOR_MAP_ADMIN_TOKEN;
  if (!configuredToken) return false;
  const suppliedToken = (req.get('authorization') || '').replace(/^Bearer\s+/i, '') || req.get('x-taylor-admin-token') || '';
  return suppliedToken.length === configuredToken.length && crypto.timingSafeEqual(Buffer.from(suppliedToken), Buffer.from(configuredToken));
}

function validateIndoorMap(map) {
  const errors = [];
  const warnings = [];
  const floors = map?.floors || {};
  for (const floor of [1, 4]) {
    if (!floors[floor]?.floorPlan?.dataUrl) errors.push(`Floor ${floor} has no imported floor plan.`);
  }
  const landmarks = Object.values(floors).flatMap((floor) => floor.landmarks || []);
  const landmarkIds = new Set(landmarks.map((landmark) => landmark.id));
  for (const destination of map.destinations || []) {
    if (!destination.landmarkId || !landmarkIds.has(destination.landmarkId)) errors.push(`Destination ${destination.name || destination.id} has no calibrated landmark.`);
  }
  const corridors = Object.values(floors).flatMap((floor) => floor.corridors || []);
  for (const corridor of corridors) {
    if (!Array.isArray(corridor.points) || corridor.points.length < 2) errors.push(`Corridor ${corridor.name || corridor.id} needs at least two points.`);
    if (!corridor.fromLandmarkId || !corridor.toLandmarkId || !landmarkIds.has(corridor.fromLandmarkId) || !landmarkIds.has(corridor.toLandmarkId)) {
      errors.push(`Corridor ${corridor.name || corridor.id} has disconnected endpoints.`);
    }
  }
  const connections = map.floorConnections || [];
  const elevatorConnections = connections.filter((connection) => connection.fromFloor === 1 && connection.toFloor === 4);
  if (!elevatorConnections.some((connection) => connection.type === 'elevator')) errors.push('A 1st-floor to 4th-floor elevator connection is required.');
  if (!map.destinations?.length) warnings.push('No destinations have been configured yet.');
  return { valid: errors.length === 0, errors, warnings };
}

app.get('/api/indoor-map/cit/published', async (_req, res) => {
  const map = await readIndoorMap();
  if (map.status !== 'published' || !map.validation?.valid) return res.status(404).json({ success: false, message: 'No validated indoor map has been published.' });
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ success: true, map });
});

app.get('/api/admin/indoor-map/cit', async (req, res) => {
  if (!adminMapAuthorized(req)) return res.status(401).json({ success: false, message: 'Administrator authentication is required.' });
  res.json({ success: true, map: await readIndoorMap() });
});

app.put('/api/admin/indoor-map/cit', async (req, res) => {
  if (!adminMapAuthorized(req)) return res.status(401).json({ success: false, message: 'Administrator authentication is required.' });
  const map = { ...req.body, building: 'CIT', status: 'draft', updatedAt: new Date().toISOString() };
  map.validation = validateIndoorMap(map);
  await writeIndoorMap(map);
  res.json({ success: true, map });
});

app.post('/api/admin/indoor-map/cit/publish', async (req, res) => {
  if (!adminMapAuthorized(req)) return res.status(401).json({ success: false, message: 'Administrator authentication is required.' });
  const map = await readIndoorMap();
  map.validation = validateIndoorMap(map);
  if (!map.validation.valid) return res.status(422).json({ success: false, validation: map.validation });
  map.status = 'published';
  map.publishedAt = new Date().toISOString();
  await writeIndoorMap(map);
  res.json({ success: true, map });
});

app.post('/api/landmarks/sync', async (req, res) => {
  if (!learningSyncAuthorized(req)) return res.status(401).json({ success: false, message: 'Learning sync authentication is required.' });
  const examples = req.body?.examples;
  if (!Array.isArray(examples) || examples.length > 120) return res.status(400).json({ success: false, message: 'examples must be an array of at most 120 records.' });
  const validExamples = examples.filter((example) => (
    example && typeof example.id === 'string' &&
    ['confirmed', 'corrected'].includes(example.status) &&
    typeof example.label === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(example.label) &&
    typeof example.imageDataUrl === 'string' && example.imageDataUrl.startsWith('data:image/')
  ));
  if (validExamples.length !== examples.length) return res.status(400).json({ success: false, message: 'Only validated confirmed/corrected image records are accepted.' });
  const directory = process.env.TAYLOR_LEARNING_SYNC_DIR || path.join(process.cwd(), 'data', 'landmark-sync');
  await mkdir(directory, { recursive: true });
  const pathName = path.join(directory, 'verified-examples.jsonl');
  const receivedAt = new Date().toISOString();
  let existingIds = new Set();
  try {
    existingIds = new Set((await readFile(pathName, 'utf8')).split('\n').filter(Boolean));
    existingIds = new Set([...existingIds].map((line) => {
      try { return JSON.parse(line).id; } catch { return null; }
    }).filter(Boolean));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const newExamples = validExamples.filter((example) => !existingIds.has(example.id));
  await appendFile(pathName, newExamples.map((example) => JSON.stringify({ ...example, receivedAt })).join('\n') + (newExamples.length ? '\n' : ''), 'utf8');
  res.json({ success: true, accepted: validExamples.map((example) => example.id), batchId: crypto.randomUUID() });
});

app.post('/api/exhibit-explanation', async (req, res) => {
  try {
    const { center, recognitionLabel, displayName } = req.body || {};
    if (!center || !displayName) {
      return res.status(400).json({ success: false, message: 'center and displayName are required' });
    }
    const explanation = await generateExhibitExplanation({ center, recognitionLabel: recognitionLabel || displayName, displayName });
    return res.json({ success: true, explanation });
  } catch (error) {
    console.error('[server] exhibit explanation error', error);
    return res.status(503).json({ success: false, errorType: 'explanation-unavailable', message: 'The explanation service is temporarily unavailable.' });
  }
});

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

app.post('/api/chat', async (req, res) => {
  console.info('[server] chat request', { method: req.method, url: req.originalUrl, body: req.body });

  try {
    const { messages = [], activeEntity = '' } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, errorType: 'backend-unavailable', message: 'messages array is required' });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      console.error('[server] missing OPENROUTER_API_KEY');
      return res.status(401).json({ success: false, errorType: 'invalid-api-key', message: 'The AI service key is not configured.' });
    }

    const openrouter = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' });
    const systemPrompt = {
      role: 'system',
      content: `${BULSU_GROUNDED_SYSTEM_PROMPT}\n\nYou assist visitors with academic programs, student services, enrollment, scholarships, research and innovation, and campus facilities. Always respond as TAYLOR, be professional, welcoming, concise, and helpful.`
    };

    const lastUserMessage = [...messages].reverse().find((message) => message?.role === 'user')?.content || '';
    const requestedEntity = normalizeBulsuEntity(lastUserMessage);
    const effectiveActiveEntity = requestedEntity || normalizeBulsuEntity(activeEntity);
    const useBulsuContext = isBulsuCenterQuestion(lastUserMessage, effectiveActiveEntity);
    const bulsuResults = useBulsuContext ? await searchBulsuCenters(lastUserMessage, { activeEntity: effectiveActiveEntity, topK: 5 }) : [];
    const bulsuContext = formatBulsuContext(bulsuResults);
    if (effectiveActiveEntity === 'RIO' && useBulsuContext && !bulsuContext) {
      const reply = 'I recognize this as RIO, but detailed RIO information is not yet available in my verified BulSU knowledge base.';
      return res.json({ success: true, reply, activeEntity: 'RIO', usedFacebookContext: false, usedBulsuContext: false });
    }
    const useFacebookContext = shouldUseFacebookContext(lastUserMessage);
    const pageContextHint = getFacebookPageContextHint(lastUserMessage);

    let facebookContext = '';
    if (useFacebookContext) {
      const results = await searchFacebookKnowledgeBase(lastUserMessage, { topK: 3 });
      if (results.length > 0) {
        facebookContext = results
          .map((item) => `Source: Facebook announcement from ${item.page_name || 'Unknown page'} on ${item.post_date || 'unknown date'}\nContent: ${item.post_text}\nURL: ${item.post_url || 'N/A'}`)
          .join('\n\n');
      } else if (pageContextHint) {
        facebookContext = `Source: ${pageContextHint.sourceHint} (${pageContextHint.pageUrl})\nContent: Advanced Robotics and Intelligent Control Center (ARICC) is the Academic Research Innovation and Commercialization Center of Bulacan State University. It supports research, innovation, commercialization, and partnerships.\nURL: ${pageContextHint.pageUrl}`;
      }
    }

    const completion = await openrouter.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct',
      messages: [
        systemPrompt,
        ...(bulsuContext
          ? [{ role: 'system', content: `Answer center questions only from this official BulSU center context.\n\n${bulsuContext}` }]
          : []),
        ...(facebookContext
          ? [{ role: 'system', content: `Use the following Facebook-derived knowledge when relevant. If the answer is based on this content, clearly say it came from a Facebook announcement.\n\n${facebookContext}` }]
          : []),
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || 'I am TAYLOR and I am here to assist you.';
    console.info('[server] success', { replyLength: reply.length, usedFacebookContext: Boolean(facebookContext), usedBulsuContext: Boolean(bulsuContext) });
    res.json({ success: true, reply, activeEntity: effectiveActiveEntity || '', usedFacebookContext: Boolean(facebookContext), usedBulsuContext: Boolean(bulsuContext) });
  } catch (error) {
    const errorInfo = classifyOpenRouterError(error);
    console.error('[server] openrouter error', {
      message: error?.message,
      status: error?.status || error?.response?.status,
      code: error?.code || error?.response?.data?.error?.code,
      detail: error?.response?.data || error,
    });
    res.status(errorInfo.status).json({ success: false, errorType: errorInfo.errorType, message: errorInfo.message, details: error?.message || '' });
  }
});

app.post('/api/facebook/index', async (req, res) => {
  try {
    const { posts, rawFilePath } = req.body || {};
    if (!Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({ success: false, message: 'posts array is required' });
    }

    const result = await indexFacebookKnowledgeBase(posts || rawFilePath || './data/facebook-posts.raw.json', {
      kbPath: './data/facebook-knowledge.json',
      collectionName: process.env.QDRANT_COLLECTION || 'facebook_posts',
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[server] facebook index error', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to index Facebook posts' });
  }
});

app.post('/api/facebook/query', async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query) {
      return res.status(400).json({ success: false, message: 'query is required' });
    }

    const results = await searchFacebookKnowledgeBase(query, { topK: 3 });
    res.json({ success: true, results });
  } catch (error) {
    console.error('[server] facebook query error', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to query Facebook knowledge base' });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`TAYLOR chat backend listening on port ${port}`);
});
