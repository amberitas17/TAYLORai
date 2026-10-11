import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pipeline, env } from '@xenova/transformers';
import { QdrantClient } from '@qdrant/js-client-rest';

env.allowLocalModels = true;

env.backends.onnx.wasm = true;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_KB_PATH = path.resolve(__dirname, '../data/facebook-knowledge.json');
export const DEFAULT_RAW_PATH = path.resolve(__dirname, '../data/facebook-posts.raw.json');
export const DEFAULT_COLLECTION = process.env.QDRANT_COLLECTION || 'facebook_posts';

let embeddingPipeline = null;

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function shouldUseFacebookContext(message = '') {
  const text = normalizeText(message);
  if (!text) {
    return false;
  }

  return /announcement|event|seminar|news|facebook|aricc|advanced robotics|intelligent control|campus|dioariccenter/i.test(text);
}

export function getFacebookPageContextHint(message = '') {
  const text = normalizeText(message).toLowerCase();
  if (/dioariccenter|aricc|advanced robotics|intelligent control/i.test(text)) {
    return {
      pageName: 'BulSU Advanced Robotics and Intelligent Control Center',
      pageUrl: 'https://www.facebook.com/DIOARICCenter',
      sourceHint: 'Advanced Robotics and Intelligent Control Center (ARICC) Facebook page',
    };
  }

  return null;
}

function getPageName(post) {
  const candidates = [
    post?.page_name,
    post?.pageName,
    post?.page?.name,
    post?.page?.title,
    post?.from?.name,
    post?.from?.full_name,
    post?.from?.page_name,
    post?.author?.name,
    post?.actor?.name,
    post?.owner?.name,
    post?.source?.name,
    post?.facebook_page_name,
    post?.data?.page_name,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return 'Unknown page';
}

function buildPostNarrative(post) {
  const pageName = getPageName(post);
  const postText = normalizeText(post?.text || post?.message || post?.post_text || '');
  const postDate = normalizeText(post?.time || post?.created_time || post?.post_date || '');
  const postUrl = normalizeText(post?.url || post?.post_url || post?.permalink_url || '');

  const comments = Array.isArray(post?.comments)
    ? post.comments
        .map((comment) => normalizeText(comment?.text || comment?.message || ''))
        .filter(Boolean)
    : [];

  const commentsText = comments.length > 0 ? ` Comments: ${comments.slice(0, 3).join(' | ')}` : '';
  return `Facebook announcement from ${pageName}. Date: ${postDate || 'unknown'}. Post: ${postText}${commentsText}. URL: ${postUrl}`.trim();
}

export async function normalizeFacebookPosts(rawPosts) {
  if (!Array.isArray(rawPosts)) {
    throw new TypeError('Expected rawPosts to be an array.');
  }

  return rawPosts.map((post, index) => ({
    id: post?.id || `facebook-${index + 1}`,
    source: 'facebook',
    page_name: getPageName(post),
    post_text: normalizeText(post?.text || post?.message || post?.post_text || ''),
    post_date: normalizeText(post?.time || post?.created_time || post?.post_date || ''),
    post_url: normalizeText(post?.url || post?.post_url || post?.permalink_url || ''),
    comments: Array.isArray(post?.comments)
      ? post.comments
          .map((comment) => ({ text: normalizeText(comment?.text || comment?.message || '') }))
          .filter((comment) => comment.text)
      : [],
    narrative: buildPostNarrative(post),
  }));
}

export async function persistFacebookKnowledgeBase(rawPosts, options = {}) {
  const normalizedPosts = await normalizeFacebookPosts(rawPosts);
  const kbPath = options.kbPath || DEFAULT_KB_PATH;

  await fs.mkdir(path.dirname(kbPath), { recursive: true });
  await fs.writeFile(kbPath, JSON.stringify(normalizedPosts, null, 2), 'utf8');

  return normalizedPosts;
}

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/bge-m3');
  }

  return embeddingPipeline;
}

async function readLocalKnowledgeBase(kbPath = DEFAULT_KB_PATH) {
  const candidates = [kbPath, DEFAULT_RAW_PATH];

  for (const candidate of candidates) {
    try {
      const absolutePath = path.resolve(candidate);
      const rawContent = await fs.readFile(absolutePath, 'utf8');
      const parsed = JSON.parse(rawContent);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      // keep trying the next candidate
    }
  }

  return [];
}

async function embedText(text) {
  try {
    const extractor = await getEmbeddingPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });

    const vector = Array.isArray(output?.data)
      ? output.data
      : Array.isArray(output?.[0])
        ? output[0]
        : output?.[0]?.data || [];

    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error('Embedding output was empty.');
    }

    return vector;
  } catch (error) {
    return [];
  }
}

export async function indexFacebookKnowledgeBase(input, options = {}) {
  let rawPosts;

  if (Array.isArray(input)) {
    rawPosts = input;
  } else {
    const absoluteInputPath = path.resolve(input);
    const rawContent = await fs.readFile(absoluteInputPath, 'utf8');
    rawPosts = JSON.parse(rawContent);
  }

  const normalizedPosts = await persistFacebookKnowledgeBase(rawPosts, options);

  const qdrantUrl = options.qdrantUrl || process.env.QDRANT_URL || 'http://localhost:6333';
  const collectionName = options.collectionName || DEFAULT_COLLECTION;
  const kbPath = options.kbPath || DEFAULT_KB_PATH;

  const client = new QdrantClient({ url: qdrantUrl, checkCompatibility: false });

  try {
    await client.createCollection(collectionName, {
      vectors: {
        size: 1024,
        distance: 'Cosine',
      },
    });
  } catch (error) {
    const message = error?.message || '';
    if (!/already exists|exists/i.test(message)) {
      throw error;
    }
  }

  const batchSize = 20;
  for (let index = 0; index < normalizedPosts.length; index += batchSize) {
    const batch = normalizedPosts.slice(index, index + batchSize);
    const points = [];

    for (const post of batch) {
      const vector = await embedText(post.narrative);
      points.push({
        id: post.id,
        vector,
        payload: {
          source: post.source,
          page_name: post.page_name,
          post_text: post.post_text,
          post_date: post.post_date,
          post_url: post.post_url,
          comments: post.comments,
        },
      });
    }

    await client.upsert(collectionName, { wait: true, points });
  }

  return {
    indexed: normalizedPosts.length,
    kbPath,
    collectionName,
  };
}

export async function searchFacebookKnowledgeBase(userQuery, options = {}) {
  const qdrantUrl = options.qdrantUrl || process.env.QDRANT_URL || 'http://localhost:6333';
  const collectionName = options.collectionName || DEFAULT_COLLECTION;
  const topK = Number(options.topK || 3);
  const kbPath = options.kbPath || DEFAULT_KB_PATH;

  const client = new QdrantClient({ url: qdrantUrl, checkCompatibility: false });

  try {
    const vector = await embedText(userQuery);
    if (vector.length === 0) {
      throw new Error('Embedding output was empty.');
    }

    const results = await client.search(collectionName, {
      vector,
      limit: topK,
      with_payload: true,
    });

    return results.map((item) => ({
      score: item.score,
      source: item.payload?.source,
      page_name: item.payload?.page_name,
      post_text: item.payload?.post_text,
      post_date: item.payload?.post_date,
      post_url: item.payload?.post_url,
      comments: item.payload?.comments || [],
    }));
  } catch (error) {
    // silently fall back to the local JSON knowledge base
  }

  try {
    const localPosts = await readLocalKnowledgeBase(kbPath);
    const normalizedPosts = await normalizeFacebookPosts(localPosts);
    const query = normalizeText(userQuery).toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);

    const filtered = normalizedPosts
      .map((post) => {
        const haystack = `${post.page_name} ${post.post_text} ${post.post_date} ${post.post_url}`.toLowerCase();
        const matchingTerms = terms.filter((term) => haystack.includes(term));
        return {
          post,
          score: matchingTerms.length,
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return filtered.map(({ post, score }) => ({
      score,
      source: post.source,
      page_name: post.page_name,
      post_text: post.post_text,
      post_date: post.post_date,
      post_url: post.post_url,
      comments: post.comments || [],
    }));
  } catch (fallbackError) {
    console.warn('[facebook-kb] local fallback failed', fallbackError?.message || fallbackError);
    return [];
  }
}
