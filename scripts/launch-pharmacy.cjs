const { spawn } = require('node:child_process');
const net = require('node:net');
require('dotenv').config({ quiet: true });

const url = 'http://127.0.0.1:3000/';
const desktopMode = process.argv.includes('--desktop');
const port = Number(process.env.PORT || 5000);
const children = [];
let stopping = false;
function run(script) {
  const child = spawn(process.execPath, [process.env.npm_execpath || require.resolve('npm/bin/npm-cli.js'), 'run', script], { stdio: 'inherit', windowsHide: true });
  children.push(child);
  return child;
}
async function occupied(number) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port: number });
    socket.setTimeout(1000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
}
async function webReady() {
  try { const res = await fetch(url, { signal: AbortSignal.timeout(15000) }); return res.ok && (await res.text()).includes('Pharmacy Workspace'); } catch { return false; }
}
async function apiReady() {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { Authorization: `Bearer ${process.env.API_TOKEN || ''}` }, signal: AbortSignal.timeout(3000) });
    return res.ok && (await res.json()).data?.ready === true;
  } catch { return false; }
}
function openBrowser() {
  if (process.argv.includes('--no-open')) return;
  if (process.platform === 'win32') {
    if (desktopMode) {
      const candidates = [
        process.env['PROGRAMFILES(X86)'] && `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
        process.env.PROGRAMFILES && `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
        process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`,
      ].filter(Boolean);
      const fs = require('node:fs');
      const edge = candidates.find(candidate => fs.existsSync(candidate));
      if (edge) {
        const child = spawn(edge, [`--app=${url}`], { windowsHide: false, stdio: 'ignore', detached: true });
        child.unref();
        return;
      }
      console.error('Microsoft Edge was not found. Install Edge to open the pharmacy desktop window.');
      return;
    }
    const child = spawn('cmd.exe', ['/d', '/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' });
    child.on('error', () => console.log(`Open ${url} in your browser.`));
  } else console.log(`Open ${url} in your browser.`);
}
async function main() {
  const [webBusy, apiBusy] = await Promise.all([occupied(3000), occupied(port)]);
  const [web, api] = await Promise.all([webBusy ? webReady() : false, apiBusy ? apiReady() : false]);
  if (process.argv.includes('--check')) { console.log(JSON.stringify({ frontendReady: web, backendReady: api, frontendPort: 3000, backendPort: port })); return; }
  if (webBusy && !web) throw new Error('Port 3000 is busy but the pharmacy frontend could not be verified. No process was stopped.');
  if (apiBusy && !api) throw new Error(`Port ${port} is busy but the pharmacy backend is not ready or its token differs. No process was stopped.`);
  if (web && api) { console.log('Pharmacy is already running. Opening the existing application.'); openBrowser(); return; }
  if (!api) {
    await new Promise((resolve, reject) => { const child = run('db:start'); child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error('Database startup failed.'))); });
    run('dev:api');
  }
  if (!web) run('dev:web');
  for (let attempt = 0; attempt < 60; attempt++) {
    if (stopping) return;
    const [frontend, backend] = await Promise.all([webReady(), apiReady()]);
    if (frontend && backend) { console.log(`Pharmacy ready: ${url}\nKeep this window open while working.`); openBrowser(); return; }
    if (children.some(child => child.exitCode !== null && child.exitCode !== 0)) throw new Error('A pharmacy process failed to start. See the message above.');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Pharmacy did not become ready in time. Check the messages above.');
}
process.on('SIGINT', () => { stopping = true; for (const child of children) if (child.exitCode === null) child.kill('SIGINT'); });
main().catch(error => { console.error(error.message); process.exitCode = 1; });
