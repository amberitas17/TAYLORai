import dotenv from 'dotenv';

dotenv.config();

let explanationServicePromise;

function loadExplanationService() {
  explanationServicePromise ||= import('../scripts/exhibitExplanationService.mjs');
  return explanationServicePromise;
}

function getMissingConfiguration() {
  const missing = [];
  if (!process.env.OPENROUTER_API_KEY) missing.push('OPENROUTER_API_KEY');
  if (!process.env.PINECONE_API_KEY) missing.push('PINECONE_API_KEY');
  if (!(
    process.env.TAVILY_API_KEY ||
    process.env.SEARXNG_BASE_URL ||
    process.env.BRAVE_SEARCH_API_KEY ||
    process.env.BING_SEARCH_V7_SUBSCRIPTION_KEY
  )) missing.push('one web search provider key or SEARXNG_BASE_URL');
  return missing;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
  try {
    const { center, recognitionLabel, displayName, language = 'en' } = req.body || {};
    if (!center || !displayName) return res.status(400).json({ success: false, message: 'center and displayName are required' });
    const missingConfiguration = getMissingConfiguration();
    if (missingConfiguration.length) {
      console.error('[exhibit-explanation] missing configuration:', missingConfiguration.join(', '));
      return res.status(503).json({
        success: false,
        errorType: 'explanation-configuration-missing',
        message: 'The explanation service is not configured for this deployment.',
      });
    }
    const { generateExhibitExplanation } = await loadExplanationService();
    const explanation = await generateExhibitExplanation({ center, recognitionLabel: recognitionLabel || displayName, displayName, language });
    return res.status(200).json({ success: true, explanation });
  } catch (error) {
    console.error('[exhibit-explanation] error', error?.stack || error);
    return res.status(503).json({
      success: false,
      errorType: 'explanation-unavailable',
      message: 'The explanation service is temporarily unavailable.',
    });
  }
}
