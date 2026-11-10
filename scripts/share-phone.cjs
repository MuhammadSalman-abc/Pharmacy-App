const { spawn } = require('node:child_process');
const { networkInterfaces } = require('node:os');
const net = require('node:net');
require('dotenv').config({ quiet: true });

const root = require('node:path').resolve(__dirname, '..');
const npm = process.env.npm_execpath || require.resolve('npm/bin/npm-cli.js');
const children = [];
const port = Number(process.env.PORT || 5000);
const webPort = Number(process.env.WEB_PORT || 3000);
const host = '0.0.0.0';
function npmRun(script, env = {}) {
  const child = spawn(process.execPath, [npm, 'run', script], { cwd: root, env: { ...process.env, ...env }, stdio: 'inherit', windowsHide: true });
  children.push(child);
  return child;
}
function available(number) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(number, host, () => server.close(() => resolve(true)));
  });
}
function localIps() {
  return Object.values(networkInterfaces()).flat().filter(item => item && item.family === 'IPv4' && !item.internal).map(item => item.address);
}
async function waitForApi() {
  const url = `http://127.0.0.1:${port}/api/health`;
  for (let n = 0; n < 60; n++) {
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.API_TOKEN || ''}` }, signal: AbortSignal.timeout(1500) });
      if (response.ok && (await response.json()).data?.ready) return;
    } catch {}
    if (children.some(child => child.exitCode !== null && child.exitCode !== 0)) throw new Error('A service exited during startup.');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('API did not become ready in time.');
}
function stop() { for (const child of children) if (child.exitCode === null) child.kill('SIGINT'); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
async function main() {
  if (!process.env.API_TOKEN || process.env.API_TOKEN.length < 32) throw new Error('Set a private API_TOKEN with at least 32 characters in .env first.');
  for (const number of [port, webPort]) if (!await available(number)) throw new Error(`Port ${number} is already in use. Close the existing pharmacy app first.`);
  await new Promise((resolve, reject) => {
    const child = npmRun('db:start');
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error('Database startup failed.')));
  });
  npmRun('start:api', { HOST: host, WEB_PORT: String(webPort) });
  await waitForApi();
  npmRun('start:web', { WEB_HOST: host });
  await new Promise(resolve => setTimeout(resolve, 700));
  const ips = localIps();
  console.log('\nMediStock phone sharing is ready on this Wi-Fi:');
  for (const ip of ips) console.log(`  http://${ip}:${webPort}`);
  console.log(`\nIn the phone app Settings, API address: http://<computer-ip>:${port}/api`);
  console.log('Keep this window open. Stop sharing with Ctrl+C.');
  console.log('\nFor install prompt, HTTPS tunnel must be running. See scripts/start-phone-tunnel.bat.');
  await new Promise(resolve => { for (const child of children) child.once('exit', resolve); });
}
main().catch(error => { console.error(error.message); stop(); process.exitCode = 1; });
