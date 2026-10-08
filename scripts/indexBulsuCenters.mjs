import dotenv from 'dotenv';

dotenv.config();
const { indexBulsuCenters, DEFAULT_PINECONE_NAMESPACE, DEFAULT_PINECONE_INDEX } = await import('./bulsuCentersKnowledgeBase.mjs');

if (!process.env.PINECONE_API_KEY?.trim() || !process.env.PINECONE_INDEX?.trim()) {
  console.error('[bulsu-index] Missing PINECONE_API_KEY or PINECONE_INDEX. No vectors were upserted.');
  process.exitCode = 1;
} else {
  try {
    const result = await indexBulsuCenters({ namespace: DEFAULT_PINECONE_NAMESPACE, indexName: DEFAULT_PINECONE_INDEX });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`[bulsu-index] ${error.message}`);
    process.exitCode = 1;
  }
}
