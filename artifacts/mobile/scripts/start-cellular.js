const { spawn } = require('child_process');

const port = process.env.PORT;

if (!port) {
  console.error('PORT is required');
  process.exit(1);
}

let expoProcess;
let tunnelProcess;
let started = false;

function stop(signal = 'SIGTERM') {
  expoProcess?.kill(signal);
  tunnelProcess?.kill(signal);
}

function startExpo(publicUrl) {
  if (started) return;
  started = true;

  const hostname = new URL(publicUrl).hostname;
  console.log(`Cellular-compatible Expo tunnel ready: ${publicUrl}`);

  expoProcess = spawn(
    'pnpm',
    ['exec', 'expo', 'start', '--localhost', '--port', port],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        EXPO_PACKAGER_PROXY_URL: publicUrl,
        REACT_NATIVE_PACKAGER_HOSTNAME: hostname,
      },
    },
  );

  expoProcess.on('exit', (code, signal) => {
    tunnelProcess?.kill('SIGTERM');
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
}

tunnelProcess = spawn(
  'ssh',
  [
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'ServerAliveInterval=30',
    '-o',
    'StrictHostKeyChecking=no',
    '-R',
    `80:localhost:${port}`,
    'nokey@localhost.run',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);

function handleTunnelOutput(chunk) {
  const output = chunk.toString();
  process.stdout.write(output);
  const match = output.match(/https:\/\/[a-z0-9.-]+\.lhr\.life/);
  if (match) startExpo(match[0]);
}

tunnelProcess.stdout.on('data', handleTunnelOutput);
tunnelProcess.stderr.on('data', handleTunnelOutput);
tunnelProcess.on('exit', (code) => {
  if (!started) {
    console.error(`Cellular-compatible Expo tunnel exited with code ${code}`);
    process.exit(code ?? 1);
  }
});

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
