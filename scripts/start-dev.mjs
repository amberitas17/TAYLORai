import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const children = [
  spawn(process.execPath, [resolve('server.js')], { stdio: 'inherit', env: process.env }),
  spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js')], { stdio: 'inherit', env: process.env }),
];

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach((child) => child.kill());
  process.exitCode = exitCode;
}

children.forEach((child) => {
  child.on('error', (error) => {
    console.error('[dev] failed to start service:', error.message);
    shutdown(1);
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[dev] service exited with code ${code ?? 'null'}${signal ? ` (${signal})` : ''}`);
      shutdown(code || 1);
    }
  });
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));