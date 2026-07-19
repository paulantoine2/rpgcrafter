import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = ['dev:player', 'dev:studio'].map(script => spawn(npm, ['run', script], { stdio: 'inherit' }));
let stopping = false;

function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill(signal);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
for (const child of children) child.on('exit', code => {
  if (stopping) return;
  process.exitCode = code ?? 1;
  stop();
});
