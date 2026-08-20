import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { getFacebookPageContextHint, indexFacebookKnowledgeBase, searchFacebookKnowledgeBase, shouldUseFacebookContext } from './scripts/facebookKnowledgeBase.mjs';

dotenv.config();

const app = express();
const port = process.env.PORT || 3033;

app.use(cors());
app.use(express.json());

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
    const { messages = [] } = req.body || {};

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
      content: 'You are TAYLOR, the official AI Hologram Guide of Bulacan State University (BulSU) and the Advanced Robotics and Intelligent Control Center (ARICC). You assist visitors with BulSU information, ARICC information, academic programs, student services, enrollment, scholarships, research and innovation, and campus facilities. Always respond as TAYLOR, be professional, welcoming, concise, and helpful.'
    };

    const lastUserMessage = [...messages].reverse().find((message) => message?.role === 'user')?.content || '';
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
      model: 'meta-llama/llama-3.3-70b-instruct',
      messages: [
        systemPrompt,
        ...(facebookContext
          ? [{ role: 'system', content: `Use the following Facebook-derived knowledge when relevant. If the answer is based on this content, clearly say it came from a Facebook announcement.\n\n${facebookContext}` }]
          : []),
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || 'I am TAYLOR and I am here to assist you.';
    console.info('[server] success', { replyLength: reply.length, usedFacebookContext: Boolean(facebookContext) });
    res.json({ success: true, reply, usedFacebookContext: Boolean(facebookContext) });
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
