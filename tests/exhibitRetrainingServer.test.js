import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(process.cwd());
const port = 3433;
const directory = mkdtempSync(path.join(os.tmpdir(), 'taylor-exhibit-server-'));
const server = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    TAYLOR_LEARNING_SYNC_TOKEN: 'integration-token',
    TAYLOR_EXHIBIT_RETRAIN_MIN_VERIFIED: '1',
    TAYLOR_EXHIBIT_RETRAINING_DIR: directory,
    TAYLOR_EXHIBIT_RETRAIN_COMMAND: `${process.execPath} -e "process.exit(0)"`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverError = '';
let serverExit = '';
server.stderr.on('data', (chunk) => { serverError += chunk.toString(); });
server.on('exit', (code, signal) => { serverExit = `exit code=${code} signal=${signal}`; });

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Test server did not start: ${serverExit} ${serverError}`);
}

try {
  await waitForServer();
  const headers = { Authorization: 'Bearer integration-token', 'Content-Type': 'application/json' };
  const base = {
    id: 'server-candidate-1',
    consented: true,
    zone: 'RECON',
    label: 'verified_class',
    imageDataUrl: `data:image/jpeg;base64,${Buffer.from('server-image').toString('base64')}`,
    reasons: ['LOW_CONFIDENCE'],
    evidence: { uncertainFrames: 2, distinctLabels: 1 },
    source: { sessionId: 'server-session' },
  };
  const rejected = await fetch(`http://127.0.0.1:${port}/api/exhibit-retraining/sync`, {
    method: 'POST', headers, body: JSON.stringify({ records: [{ ...base, status: 'VERIFIED', independentlyVerified: false }] }),
  });
  assert.equal(rejected.status, 400);

  const accepted = await fetch(`http://127.0.0.1:${port}/api/exhibit-retraining/sync`, {
    method: 'POST', headers, body: JSON.stringify({ records: [{ ...base, status: 'VERIFIED', independentlyVerified: true, verificationSource: 'human_review' }] }),
  });
  assert.equal(accepted.status, 200);
  const payload = await accepted.json();
  assert.deepEqual(payload.accepted, ['server-candidate-1']);
  assert.equal(payload.verifiedCount, 1);
  assert.equal(payload.trigger.status, 'started');
  console.log('Exhibit retraining server integration passed');
} finally {
  server.kill();
  rmSync(directory, { recursive: true, force: true });
}