import assert from 'node:assert/strict';
import { createKnowledgeIndex } from '../src/services/localKnowledgeService.js';
import { resolveLocalFirstChat } from '../src/services/localKnowledgeChat.js';

const index = createKnowledgeIndex();
let backendCalls = 0;

const local = await resolveLocalFirstChat({
    query: 'What is ARICC?',
    index,
    requestBackend: async () => {
        backendCalls += 1;
        return { unexpected: true };
    },
});
assert.equal(local.kind, 'local');
assert.equal(backendCalls, 0);

const onlineFallback = await resolveLocalFirstChat({
    query: 'What is a quantum telescope?',
    index,
    requestBackend: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { reply: 'Verified by the online service.' };
    },
});
assert.equal(onlineFallback.kind, 'backend');
assert.equal(onlineFallback.response.reply, 'Verified by the online service.');

const interrupted = await resolveLocalFirstChat({
    query: 'What is a quantum telescope?',
    index,
    requestBackend: async () => {
        throw new Error('Failed to fetch');
    },
});
assert.equal(interrupted.kind, 'unavailable');
assert.match(interrupted.message, /not available locally/i);

const rioOffline = await resolveLocalFirstChat({
    query: 'What is RIO?',
    index,
    requestBackend: async () => {
        throw new Error('Network request failed');
    },
});
assert.equal(rioOffline.kind, 'unavailable');
assert.match(rioOffline.message, /RIO/i);

console.log('Local-first chat routing passed');
