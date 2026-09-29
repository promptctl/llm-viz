// Spike llm-tower-n3c.5gn (2026-09-29): load time and memory of the two ways to run GPT-2 small in
// the browser. Not part of `pnpm test`. From the repo root, with the dev deps installed:
//   node spikes/5gn-activation-path/run.mjs raw              # safetensors -> GPUBuffers, no forward
//   node spikes/5gn-activation-path/run.mjs ort dtype=fp32   # transformers.js + onnxruntime-web (or fp16)
// Each run prints a cold and a Cache-API-warm pass as JSON. A profile-* dir beside this file is the
// persistent browser profile; delete it for a true cold run. Unset SSL_CERT_FILE first if your shell
// pins one. The results-* dirs are the runs the ticket cites.
import { chromium } from '@playwright/test';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const [page, ...rest] = process.argv.slice(2); const query = rest.join('&');
if (!['raw', 'ort'].includes(page)) throw new Error('usage: node run.mjs raw|ort [dtype=fp32|fp16]');
// Serves the one page under test to this machine only; every other path is a 404.
const html = fs.readFileSync(path.join(dir, page + '.html'));
const server = http.createServer((req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Content-Type', 'text/html');
  req.url.split('?')[0] === `/${page}.html` ? res.end(html) : (res.statusCode = 404, res.end());
}).listen(5199, '127.0.0.1');
function rssTree(root) {
  const rows = execSync('ps -axo pid=,ppid=,rss=').toString().trim().split('\n').map(l => l.trim().split(/\s+/).map(Number));
  const kids = new Map(); for (const [pid, ppid] of rows) (kids.get(ppid) ?? kids.set(ppid, []).get(ppid)).push(pid);
  const rss = new Map(rows.map(([pid, , r]) => [pid, r]));
  let total = 0; const stack = [root]; while (stack.length) { const p = stack.pop(); total += rss.get(p) ?? 0; for (const k of kids.get(p) ?? []) stack.push(k); }
  return total * 1024;
}
const userDataDir = path.join(dir, 'profile-' + page + (query ? '-' + query.replace(/\W/g, '_') : ''));
const ctx = await chromium.launchPersistentContext(userDataDir, { channel: 'chromium', headless: true,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=WebGPU', '--enable-precise-memory-info'] });
// The browser is our direct child with a profile; its helpers carry --type=, and execSync's shell has no profile.
const pid = (() => {
  const rows = execSync('ps -axo pid=,ppid=,command=').toString().trim().split('\n').map(l => l.trim().split(/\s+/));
  const mine = rows.filter(([, ppid, ...cmd]) => Number(ppid) === process.pid && cmd.some(a => a.startsWith('--user-data-dir=')) && !cmd.some(a => a.startsWith('--type=')));
  if (mine.length !== 1) throw new Error('browser pid: ' + mine.length + ' candidates');
  return Number(mine[0][0]);
})();
const results = [];
for (const run of ['cold', 'warm']) {
  const p = await ctx.newPage();
  await p.goto('about:blank'); await new Promise(r => setTimeout(r, 1500));
  const before = rssTree(pid);
  // A page that throws sets window.result too, so a dead page ends the wait instead of timing out.
  await p.addInitScript(() => addEventListener('error', e => { window.result ??= { page_error: e.message }; }));
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const t0 = Date.now();
  await p.goto(`http://localhost:5199/${page}.html?${query}`);
  await p.waitForFunction(() => window.result, null, { timeout: 15 * 60_000 }).catch(e => errors.push('timeout: ' + e.message));
  const result = await p.evaluate(() => window.result ?? null);
  const after = rssTree(pid);
  results.push({ run, wall_ms: Date.now() - t0, rss_delta_bytes: after - before, rss_after_bytes: after, ...result, errors });
  await p.close();
}
console.log(JSON.stringify(results, null, 1));
await ctx.close(); server.close();
