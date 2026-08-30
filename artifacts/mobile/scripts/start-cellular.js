const { spawn } = require('child_process');
const http = require('http');
const net = require('net');

const port = process.env.PORT;
const metroPort = process.env.EXPO_METRO_PORT || '8082';
const apiPort = process.env.API_SERVER_PORT || '8080';

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
  gateway.close();
}

function startExpo(publicUrl) {
  if (started) return;
  started = true;

  const hostname = new URL(publicUrl).hostname;
  console.log(`Cellular-compatible Expo tunnel ready: ${publicUrl}`);

  expoProcess = spawn(
    'pnpm',
    ['exec', 'expo', 'start', '--localhost', '--port', metroPort],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        EXPO_PUBLIC_DOMAIN: hostname,
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

function targetFor(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/')
    ? { port: apiPort, name: 'API' }
    : { port: metroPort, name: 'Metro' };
}

const gateway = http.createServer((req, res) => {
  const target = targetFor(req.url || '/');
  const proxyRequest = http.request(
    {
      hostname: '127.0.0.1',
      port: target.port,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: `127.0.0.1:${target.port}` },
    },
    (proxyResponse) => {
      res.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
      proxyResponse.pipe(res);
    },
  );

  proxyRequest.on('error', (error) => {
    console.error(`${target.name} proxy request failed: ${error.message}`);
    if (!res.headersSent) res.writeHead(502);
    res.end('Upstream unavailable');
  });
  req.pipe(proxyRequest);
});

gateway.on('upgrade', (req, socket, head) => {
  const target = targetFor(req.url || '/');
  const upstream = net.connect(Number(target.port), '127.0.0.1', () => {
    const headers = Object.entries(req.headers)
      .map(([name, value]) => `${name}: ${value}`)
      .join('\r\n');
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers}\r\n\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
});

gateway.listen(Number(port), '0.0.0.0', () => {
  console.log(`Expo/API gateway listening on port ${port}`);
});

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
