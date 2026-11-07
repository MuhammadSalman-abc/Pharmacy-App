require('dotenv').config({ quiet: true });
const { spawn } = require('node:child_process');
const token = process.env.API_TOKEN;
if (!token || token.length < 32) { console.error('Configure API_TOKEN in .env first.'); process.exit(1); }
if (process.platform !== 'win32') { console.error('This clipboard shortcut is for Windows.'); process.exit(1); }
const child = spawn('clip.exe', [], { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
child.on('error', () => { console.error('Clipboard unavailable. Copy API_TOKEN manually from .env.'); process.exitCode = 1; });
child.on('exit', code => { if (code === 0) console.log('Local API token copied. Paste it into Settings > Local API token, then Connect & verify.'); else process.exitCode = 1; });
child.stdin.end(token);
