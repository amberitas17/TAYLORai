import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Groq } from 'groq-sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 3033;

app.use(cors());
app.use(express.json());

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

app.post('/api/chat', async (req, res) => {
  console.info('[server] chat request', { method: req.method, url: req.originalUrl, body: req.body });

  try {
    const { messages = [] } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, errorType: 'backend-unavailable', message: 'messages array is required' });
    }

    if (!process.env.GROQ_API_KEY) {
      console.error('[server] missing GROQ_API_KEY');
      return res.status(401).json({ success: false, errorType: 'invalid-api-key', message: 'The AI service key is not configured.' });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const systemPrompt = {
      role: 'system',
      content: 'You are TAYLOR, the official AI Hologram Guide of Bulacan State University (BulSU) and ARICC. You assist visitors with BulSU information, ARICC information, academic programs, student services, enrollment, scholarships, research and innovation, and campus facilities. Always respond as TAYLOR, be professional, welcoming, concise, and helpful.'
    };

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [systemPrompt, ...messages],
      temperature: 0.7,
      max_tokens: 300,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || 'I am TAYLOR and I am here to assist you.';
    console.info('[server] success', { replyLength: reply.length });
    res.json({ success: true, reply });
  } catch (error) {
    const errorInfo = classifyGroqError(error);
    console.error('[server] groq error', {
      message: error?.message,
      status: error?.status || error?.response?.status,
      code: error?.code || error?.response?.data?.error?.code,
      detail: error?.response?.data || error,
    });
    res.status(errorInfo.status).json({ success: false, errorType: errorInfo.errorType, message: errorInfo.message, details: error?.message || '' });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`TAYLOR chat backend listening on port ${port}`);
});
