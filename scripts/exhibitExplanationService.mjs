import OpenAI from 'openai';
import { formatBulsuContext, searchBulsuCenters } from './bulsuCentersKnowledgeBase.mjs';

const pendingRequests = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(operation, { timeoutMs = 8000, retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    let timer;
    try {
      const operationPromise = operation(controller.signal);
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });
      return await Promise.race([operationPromise, timeoutPromise]);
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(300 * (2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function searchWeb(query) {
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();
  if (tavilyKey) {
    const response = await withRetry((signal) => fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: false,
        include_raw_content: false,
      }),
    }));
    if (response.status === 429) throw new Error('Tavily rate limit exceeded.');
    if (!response.ok) throw new Error(`Tavily Search returned ${response.status}`);
    const payload = await response.json();
    return deduplicateSources((payload.results || []).map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.content || '',
      source: item.url,
      type: 'web',
    })).filter((item) => item.url));
  }

  const searxngBaseUrl = process.env.SEARXNG_BASE_URL?.trim();
  if (searxngBaseUrl) {
    const endpoint = new URL('/search', `${searxngBaseUrl.replace(/\/$/, '')}/`);
    endpoint.searchParams.set('q', query);
    endpoint.searchParams.set('format', 'json');
    endpoint.searchParams.set('categories', 'general');
    endpoint.searchParams.set('safesearch', '1');
    const response = await withRetry((signal) => fetch(endpoint, {
      signal,
      headers: { Accept: 'application/json' },
    }));
    if (response.status === 429) throw new Error('SearXNG rate limit exceeded.');
    if (!response.ok) throw new Error(`SearXNG returned ${response.status}`);
    const payload = await response.json();
    return deduplicateSources((payload.results || []).map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.content || item.description || '',
      source: item.url,
      type: 'web',
    })).filter((item) => item.url));
  }

  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  if (braveKey) {
    const response = await withRetry((signal) => fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
      signal,
      headers: { Accept: 'application/json', 'X-Subscription-Token': braveKey },
    }));
    if (!response.ok) throw new Error(`Brave Search returned ${response.status}`);
    const payload = await response.json();
    return deduplicateSources((payload.web?.results || []).map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.description,
      source: item.url,
      type: 'web',
    })).filter((item) => item.url));
  }

  const bingKey = process.env.BING_SEARCH_V7_SUBSCRIPTION_KEY;
  if (bingKey) {
    const endpoint = process.env.BING_SEARCH_ENDPOINT || 'https://api.bing.microsoft.com/v7.0/search';
    const response = await withRetry((signal) => fetch(`${endpoint}?q=${encodeURIComponent(query)}&count=5&responseFilter=Webpages`, {
      signal,
      headers: { 'Ocp-Apim-Subscription-Key': bingKey },
    }));
    if (!response.ok) throw new Error(`Bing Search returned ${response.status}`);
    const payload = await response.json();
    return deduplicateSources((payload.webPages?.value || []).map((item) => ({
      title: item.name,
      url: item.url,
      snippet: item.snippet,
      source: item.url,
      type: 'web',
    })).filter((item) => item.url));
  }

  throw new Error('No configured web search provider. Set TAVILY_API_KEY or explicitly configure SEARXNG_BASE_URL.');
}

function deduplicateSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    const key = String(source.url || source.source || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceFromBulsu(item) {
  return {
    title: item.section || item.full_name || item.entity,
    url: item.source || null,
    source: item.source || `${item.entity || 'BulSU'} knowledge base`,
    type: 'bulsu',
  };
}

function normalizeSourceReference(value) {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  return String(value.url || value.source || '').trim();
}

function normalizeSourceUrl(value) {
  const reference = normalizeSourceReference(value);
  if (!reference) return '';
  try {
    const url = new URL(reference);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return reference.replace(/\/$/, '');
  }
}

function parseGeneratedContent(content, allowedSources) {
  const jsonText = String(content || '').match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) throw new Error('The explanation generator did not return JSON.');
  const parsed = JSON.parse(jsonText);
  if (!parsed.whatIsIt || !parsed.purpose || !Array.isArray(parsed.sources) || parsed.sources.length === 0) {
    throw new Error('Generated explanation is missing required grounded fields or sources.');
  }
  const groundedSources = parsed.sources
    .map((source) => {
      const reference = normalizeSourceUrl(source);
      return allowedSources.find((allowed) => reference && (
        reference === normalizeSourceUrl(allowed.url) ||
        reference === normalizeSourceUrl(allowed.source)
      ));
    })
    .filter(Boolean);
  return {
    whatIsIt: String(parsed.whatIsIt).trim(),
    purpose: String(parsed.purpose).trim(),
    sources: groundedSources,
  };
}

export async function generateExhibitExplanation({ center, recognitionLabel, displayName }) {
  const key = `${String(center).toUpperCase()}:${recognitionLabel}:${displayName}`;
  if (pendingRequests.has(key)) return pendingRequests.get(key);

  const request = (async () => {
    const bulsuResults = await withRetry(() => searchBulsuCenters(
      `${center} ${displayName} ${recognitionLabel} exhibit equipment purpose`,
      { activeEntity: center, topK: 5, requirePinecone: true },
    ));
    const bulsuContext = formatBulsuContext(bulsuResults);
    const webResults = await searchWeb(`${center} ${displayName} official equipment description purpose`);
    const bulsuSources = bulsuResults.map(sourceFromBulsu);
    const webSources = webResults.map((item) => ({ ...item, type: item.type || 'web' }));
    const allowedSources = [...bulsuSources, ...webSources];
    const sourceContext = [
      bulsuContext ? `BulSU sources:\n${bulsuContext}` : '',
      webResults.length ? `General authoritative web sources:\n${webResults.map((item) => `${item.title}\n${item.snippet}\nURL: ${item.url}`).join('\n\n')}` : '',
    ].filter(Boolean).join('\n\n');
    if (!sourceContext) throw new Error('No grounded sources were retrieved.');

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');
    const openrouter = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' });
    const completion = await withRetry(() => openrouter.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: 'Return JSON only with keys whatIsIt, purpose, sources. Use only the supplied sources. Keep each explanation concise and visitor-friendly. Clearly separate BulSU-specific facts from general equipment facts. Never infer specifications, capabilities, or uses not supported by a source. Include at least one supplied source in sources.' },
        { role: 'user', content: `Exhibit center: ${center}\nRecognition label: ${recognitionLabel}\nDisplay name: ${displayName}\n\n${sourceContext}` },
      ],
      temperature: 0.2,
      max_tokens: 240,
    }), { timeoutMs: 15000, retries: 2 });
    const generated = parseGeneratedContent(completion.choices?.[0]?.message?.content, allowedSources);
    if (!generated.sources.length) throw new Error('Generated explanation has no usable source references.');
    return {
      center: String(center).toUpperCase(),
      recognitionLabel,
      displayName,
      ...generated,
      verified: true,
      generatedAt: new Date().toISOString(),
      knowledgeVersion: 'exhibit-explanations-v1',
    };
  })();

  pendingRequests.set(key, request);
  try {
    return await request;
  } finally {
    pendingRequests.delete(key);
  }
}
