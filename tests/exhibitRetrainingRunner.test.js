import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(process.cwd());
const python = path.join(root, '.venv', 'Scripts', 'python.exe');
const runner = path.join(root, 'scripts', 'run_exhibit_retraining.py');
const temp = path.join(os.tmpdir(), `taylor-exhibit-runner-${Date.now()}`);
const recordsPath = path.join(temp, 'candidate-records.jsonl');
const output = path.join(temp, 'job');
mkdirSync(temp, { recursive: true });

const records = Array.from({ length: 8 }, (_, index) => ({
  id: `candidate-${index}`,
  status: 'VERIFIED',
  independentlyVerified: true,
  verificationSource: 'human_review',
  consented: true,
  zone: 'RECON',
  label: 'verified_class',
  imageDataUrl: `data:image/jpeg;base64,${Buffer.from(`image-${index}`).toString('base64')}`,
  reasons: ['LOW_CONFIDENCE'],
  evidence: { uncertainFrames: 2, distinctLabels: 1 },
  source: { sessionId: `session-${index % 3}` },
}));
writeFileSync(recordsPath, records.map((record) => JSON.stringify(record)).join('\n'));

try {
  const dryRun = spawnSync(python, [runner, '--records', recordsPath, '--output', output, '--dry-run'], { encoding: 'utf8' });
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /"status": "dry_run"/);
  assert.equal(existsSync(path.join(output, 'candidate', 'datasets', 'RECON', 'train', 'verified_class', 'verified-candidate-0.jpg')), true);

  const lock = path.join(output, '.training.lock');
  writeFileSync(lock, 'active');
  const recovery = spawnSync(python, [runner, '--records', recordsPath, '--output', output, '--dry-run'], { encoding: 'utf8' });
  assert.equal(recovery.status, 4, recovery.stderr);
  assert.match(recovery.stdout, /recovered_existing_job/);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

execFileSync(process.execPath, ['-e', 'console.log("runner integration passed")'], { stdio: 'inherit' });