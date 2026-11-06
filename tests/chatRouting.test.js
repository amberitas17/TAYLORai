import assert from 'node:assert/strict';
import { classifyChatQuestion, getWebSearchOptions } from '../scripts/chatRouting.mjs';

assert.deepEqual(classifyChatQuestion('What is artificial intelligence?', 'RIO'), {
  topic: 'general', entity: '', useBulsuContext: false, useWebSearch: false,
});
assert.deepEqual(classifyChatQuestion('What is ARICC?', 'RIO'), {
  topic: 'institutional', entity: 'ARICC', useBulsuContext: true, useWebSearch: false,
});
assert.deepEqual(classifyChatQuestion('What services does it offer?', 'RIO'), {
  topic: 'institutional', entity: 'RIO', useBulsuContext: true, useWebSearch: false,
});
assert.deepEqual(classifyChatQuestion('What is machine learning?', 'RIO'), {
  topic: 'general', entity: '', useBulsuContext: false, useWebSearch: false,
});
assert.equal(classifyChatQuestion('What is the latest AI news?', 'RIO').topic, 'current');
assert.deepEqual(getWebSearchOptions({ useWebSearch: false }), {});
console.log('Chat routing regression tests passed');