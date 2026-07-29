import dotenv from 'dotenv';
import { Groq } from 'groq-sdk';

dotenv.config();

const SYSTEM_PROMPT = 'You are TAYLOR, the official AI Hologram Guide of Bulacan State University (BulSU) and ARICC. You assist visitors with BulSU information, ARICC information, academic programs, student services, enrollment, scholarships, research and innovation, and campus facilities. Always respond as TAYLOR, be professional, welcoming, concise, and helpful.';

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

function classifyGroqError(error) {
  const status = error?.status || error?.response?.status;
  const code = error?.code || error?.response?.data?.error?.code;
  const message = error?.message || '';

  if (!process.env.GROQ_API_KEY || /api key|invalid_api_key/i.test(message) || code === 'invalid_api_key') {
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
    const { messages = [] } = body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ success: false, errorType: 'backend-unavailable', message: 'messages array is required' });
      return;
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error('[chat] missing GROQ_API_KEY');
      res.status(401).json({ success: false, errorType: 'invalid-api-key', message: 'The AI service key is not configured.' });
      return;
    }

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
      max_tokens: 300,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || 'I am TAYLOR and I am here to assist you.';
    console.info('[chat] success', { replyLength: reply.length });
    res.status(200).json({ success: true, reply });
  } catch (error) {
    const errorInfo = classifyGroqError(error);
    console.error('[chat] groq error', {
      message: error?.message,
      status: error?.status || error?.response?.status,
      code: error?.code || error?.response?.data?.error?.code,
      detail: error?.response?.data || error,
    });
    res.status(errorInfo.status).json({ success: false, errorType: errorInfo.errorType, message: errorInfo.message, details: error?.message || '' });
  }
}
