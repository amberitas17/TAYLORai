import assert from 'node:assert/strict';
import {
    LOCAL_KNOWLEDGE_SCHEMA_VERSION,
    createKnowledgeIndex,
    loadKnowledgeIndex,
    saveKnowledgeIndex,
    searchLocalKnowledge,
} from '../src/services/localKnowledgeService.js';

class FakeObjectStore {
    constructor(values, transaction) {
        this.values = values;
        this.transaction = transaction;
    }

    put(value, key) {
        this.values.set(key, value);
        queueMicrotask(() => this.transaction.oncomplete?.());
    }

    get(key) {
        const request = { result: this.values.get(key), onsuccess: null, onerror: null };
        queueMicrotask(() => request.onsuccess?.());
        return request;
    }
}

class FakeDatabase {
    constructor() {
        this.values = new Map();
    }

    transaction() {
        const transaction = {
            objectStore: null,
            oncomplete: null,
            onerror: null,
        };
        transaction.objectStore = () => new FakeObjectStore(this.values, transaction);
        return transaction;
    }
}

const index = createKnowledgeIndex();
assert.equal(index.recordCount, 26);
assert.deepEqual(Object.keys(index.entities).sort(), ['ARICC', 'BARAS TBI', 'CAESAR', 'CBS', 'FABLAB', 'FIC', 'RECON']);

for (const query of ['What is ARICC?', 'Tell me about ARICC.', 'What services does ARICC offer?']) {
    const result = searchLocalKnowledge(query, { index });
    assert.equal(result.match.entity, 'ARICC');
    assert.ok(result.match.sourceIds.length > 0);
    assert.ok(result.latencyMs < 50);
}

const recon = searchLocalKnowledge('How does RECON support disaster resilience and renewable energy?', { index });
assert.equal(recon.match.entity, 'RECON');
assert.match(recon.match.text, /renewable energy/i);

const fablabLocation = searchLocalKnowledge('Where is the BulSU Fablab located?', { index });
assert.equal(fablabLocation.match.entity, 'FABLAB');
assert.match(fablabLocation.match.text, /Alvarado Hall/i);

const rio = searchLocalKnowledge('What is RIO?', { index });
assert.equal(rio.match, null);
assert.equal(rio.entity, 'RIO');

const unknown = searchLocalKnowledge('What is a quantum telescope?', { index });
assert.equal(unknown.match, null);

const database = new FakeDatabase();
await saveKnowledgeIndex(index, database);
const restored = await loadKnowledgeIndex(database);
assert.equal(restored.knowledgeVersion, index.knowledgeVersion);
assert.equal(restored.entityCount, index.entityCount);

database.values.set('bulsu-centers', { ...index, schemaVersion: LOCAL_KNOWLEDGE_SCHEMA_VERSION + 1 });
assert.equal(await loadKnowledgeIndex(database), null);

const serializedBytes = JSON.stringify(index).length;
assert.ok(serializedBytes < 30000);
console.log(JSON.stringify({
    recordCount: index.recordCount,
    entityCount: index.entityCount,
    serializedBytes,
    measuredQueries: 6,
}));