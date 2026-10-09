import dotenv from 'dotenv';
import OpenAI from 'openai';
import bulsuRecords from '../data/bulsu-centers.records.json' with { type: 'json' };

dotenv.config();

const BULSU_GROUNDED_SYSTEM_PROMPT = `You are TAYLOR, an AI assistant for Bulacan State University.\n\nFor questions about BulSU centers, use the supplied knowledge-base context as the factual source. Do not invent services, facilities, locations, contact information, research programs, or organizational details that are absent from the supplied context.`;
const SYSTEM_PROMPT = `${BULSU_GROUNDED_SYSTEM_PROMPT}\n\nYou assist visitors with academic programs, student services, enrollment, scholarships, research and innovation, and campus facilities. Always respond as TAYLOR, be professional, welcoming, concise, and helpful.`;
const BULSU_ENTITIES = ['ARICC', 'RIO', 'CAESAR', 'CBS', 'FABLAB', 'BARAS TBI', 'FIC', 'RECON'];

function normalizeBulsuEntity(value = '') {
  const text = String(value).toLowerCase();
  return BULSU_ENTITIES.find((entity) => text.includes(entity.toLowerCase())) || '';
}

function isBulsuCenterQuestion(message = '', activeEntity = '') {
  return Boolean(normalizeBulsuEntity(message) || normalizeBulsuEntity(activeEntity) || /bulsu|bulacan state university|center|research|innovation/i.test(message));
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
    const bulsuResults = isBulsuCenterQuestion(lastUserMessage, effectiveActiveEntity)
      ? searchBulsuCenters(lastUserMessage, effectiveActiveEntity)
      : [];
    const bulsuContext = formatBulsuContext(bulsuResults);
    if (effectiveActiveEntity === 'RIO' && isBulsuCenterQuestion(lastUserMessage, effectiveActiveEntity) && !bulsuContext) {
      const reply = 'I recognize this as RIO, but detailed RIO information is not yet available in my verified BulSU knowledge base.';
      res.status(200).json({ success: true, reply, activeEntity: 'RIO', usedBulsuContext: false });
      return;
    }
    const completion = await openrouter.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(bulsuContext ? [{ role: 'system', content: `Answer center questions only from this official BulSU center context.\n\n${bulsuContext}` }] : []),
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || 'I am TAYLOR and I am here to assist you.';
    console.info('[chat] success', { replyLength: reply.length });
    res.status(200).json({ success: true, reply, activeEntity: effectiveActiveEntity || '', usedBulsuContext: Boolean(bulsuContext) });
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
