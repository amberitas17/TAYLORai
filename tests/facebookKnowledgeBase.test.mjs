import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeFacebookPosts, searchFacebookKnowledgeBase, shouldUseFacebookContext } from '../scripts/facebookKnowledgeBase.mjs';

test('normalizes Facebook page names from nested from.name fields', async () => {
  const posts = [{
    id: 'fb-1',
    from: { name: 'BulSU ARICC' },
    message: 'Campus seminar starts tomorrow',
    created_time: '2026-08-07',
  }];

  const [post] = await normalizeFacebookPosts(posts);

  assert.equal(post.page_name, 'BulSU ARICC');
  assert.match(post.narrative, /BulSU ARICC/);
});

test('uses Facebook context for ARICC questions', () => {
  assert.equal(shouldUseFacebookContext('What is ARICC?'), true);
  assert.equal(shouldUseFacebookContext('Tell me about the campus seminar'), true);
  assert.equal(shouldUseFacebookContext('How are you today?'), false);
});

test('returns local Facebook knowledge for ARICC queries', async () => {
  const results = await searchFacebookKnowledgeBase('What is ARICC?', { topK: 3, kbPath: './data/facebook-posts.raw.json' });
  assert.ok(results.length > 0, 'expected ARICC knowledge to be returned');
  assert.ok(results.some((item) => /ARICC/i.test(item.post_text || '')));
});
