import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Groq } from 'groq-sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 3033;

app.use(cors());
app.use(express.json());

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const FALLBACK_REPLY = 'I am TAYLOR, and I am here to help you explore Bulacan State University and ARICC. I am currently using a fallback response while the AI service is unavailable.';

const fallbackReply = 'I am here to help with BulSU and ARICC. I am currently having trouble reaching the AI service, but I can still share general information about programs, services, scholarships, and campus facilities.';

app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [] } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    if (!groq) {
      console.warn('Groq API key not configured; returning fallback reply.');
      return res.status(200).json({ reply: fallbackReply });
    }

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
    res.json({ reply });
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(200).json({ reply: fallbackReply });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`TAYLOR chat backend listening on port ${port}`);
});
