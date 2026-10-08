import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const kb = await import('./bulsuCentersKnowledgeBase.mjs');
const namespace = process.env.PINECONE_BULSU_NAMESPACE || 'bulsu-centers';
const indexName = process.env.PINECONE_INDEX;
const topK = 5;

if (!process.env.PINECONE_API_KEY || !indexName) {
  throw new Error('PINECONE_API_KEY and PINECONE_INDEX are required.');
}

const queries = [
  'What is ARICC?',
  'What services does ARICC offer?',
  'What is CAESAR?',
  'What does FABLAB provide?',
  'What is BARAS TBI?',
  'What is the Food Innovation Center?',
  'What does RECON do?',
  'What is the Center for Bulacan Studies?',
];

async function retrieve(query, activeEntity = '') {
  const detectedEntity = kb.normalizeBulsuEntity(activeEntity || query);
  const results = await kb.searchBulsuCenters(query, {
    activeEntity,
    indexName,
    namespace,
    topK,
    requirePinecone: true,
  });
  return {
    query,
    activeEntity: activeEntity || null,
    detectedEntity: detectedEntity || null,
    filterEntity: detectedEntity || null,
    topK,
    results: results.map((item) => ({
      id: item.id,
      entity: item.entity,
      section: item.section,
      score: item.score,
      source: item.source,
    })),
    context: kb.formatBulsuContext(results),
  };
}

const retrieval = [];
for (const query of queries) retrieval.push(await retrieve(query));
retrieval.push(await retrieve('What services do they offer?', 'ARICC'));
retrieval.push(await retrieve('What does this center do?', 'FABLAB'));
retrieval.push(await retrieve('What does this center do?', 'CAESAR'));
retrieval.push(await retrieve('What does this center do?', 'RECON'));

if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is required for Llama verification.');

const openrouter = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' });
const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-70b-instruct';
const systemPrompt = `${kb.BULSU_GROUNDED_SYSTEM_PROMPT}\n\nAnswer only from the supplied Pinecone context. If the context does not contain the requested fact, say that the available knowledge does not provide it. Never infer or invent a person's name.`;

async function answer(query, activeEntity = '') {
  const retrieved = await retrieve(query, activeEntity);
  const completion = await openrouter.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: `Pinecone context:\n\n${retrieved.context}` },
      { role: 'user', content: query },
    ],
    temperature: 0,
    max_tokens: 300,
  });
  return {
    query,
    activeEntity: activeEntity || null,
    retrievedIds: retrieved.results.map((item) => item.id),
    reply: completion.choices?.[0]?.message?.content?.trim() || '',
  };
}

console.log(JSON.stringify({
  indexName,
  namespace,
  retrieval,
  llamaModel: model,
  llamaTests: [
    await answer('What services does ARICC offer?'),
    await answer('What services do they offer?', 'ARICC'),
    await answer('Who is the current director of ARICC?', 'ARICC'),
  ],
}, null, 2));