import dotenv from 'dotenv';
import { generateExhibitExplanation } from '../scripts/exhibitExplanationService.mjs';

dotenv.config();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
  try {
    const { center, recognitionLabel, displayName } = req.body || {};
    if (!center || !displayName) return res.status(400).json({ success: false, message: 'center and displayName are required' });
    const explanation = await generateExhibitExplanation({ center, recognitionLabel: recognitionLabel || displayName, displayName });
    return res.status(200).json({ success: true, explanation });
  } catch (error) {
    console.error('[exhibit-explanation] error', error);
    return res.status(503).json({ success: false, errorType: 'explanation-unavailable', message: 'The explanation service is temporarily unavailable.' });
  }
}
