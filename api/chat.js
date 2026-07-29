import dotenv from 'dotenv';
import { Groq } from 'groq-sdk';

dotenv.config();

const SYSTEM_PROMPT = 'You are TAYLOR, the official AI Hologram Guide of Bulacan State University (BulSU) and ARICC. You assist visitors with BulSU information, ARICC information, academic programs, student services, enrollment, scholarships, research and innovation, and campus facilities. Always respond as TAYLOR, be professional, welcoming, concise, and helpful.';

const fallbackReply = 'I am here to help with BulSU and ARICC. I am currently having trouble reaching the AI service, but I can still share general information about programs, services, scholarships, and campus facilities.';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { messages = [] } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      res.status(200).json({ reply: fallbackReply });
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
    res.status(200).json({ reply });
  } catch (error) {
    console.error('Groq chat API error:', error);
    res.status(200).json({ reply: fallbackReply });
  }
}
