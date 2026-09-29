// Spike llm-tower-n3c.5gn (2026-09-29): load time and memory of the two ways to run GPT-2 small in
// the browser. Not part of `pnpm test`. From the repo root, with the dev deps installed:
//   node spikes/5gn-activation-path/run.mjs raw              # safetensors -> GPUBuffers, no forward
//   node spikes/5gn-activation-path/run.mjs ort dtype=fp32   # transformers.js + onnxruntime-web (or fp16)
// Each run prints a cold and a Cache-API-warm pass as JSON. A profile-* dir beside this file is the
// persistent browser profile; delete it for a true cold run. Unset SSL_CERT_FILE first if your shell
// pins one. The results-* dirs are the runs the ticket cites.
import { chromium } from '@playwright/test';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process';
const dir = path.dirname(new URL(import.meta.url).pathname);
const server = http.createServer((req, res) => {
  const f = path.join(dir, req.url.split('?')[0].replace(/^\//, '') || 'index.html');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Content-Type', 'text/html');
  fs.existsSync(f) ? res.end(fs.readFileSync(f)) : (res.statusCode = 404, res.end());
}).listen(5199);
function rssTree(root) {
  const rows = execSync('ps -axo pid=,ppid=,rss=').toString().trim().split('\n').map(l => l.trim().split(/\s+/).map(Number));
  const kids = new Map(); for (const [pid, ppid] of rows) (kids.get(ppid) ?? kids.set(ppid, []).get(ppid)).push(pid);
  const rss = new Map(rows.map(([pid, , r]) => [pid, r]));
  let total = 0; const stack = [root]; while (stack.length) { const p = stack.pop(); total += rss.get(p) ?? 0; for (const k of kids.get(p) ?? []) stack.push(k); }
  return total * 1024;
}
const [page, ...rest] = process.argv.slice(2); const query = rest.join('&');
const userDataDir = path.join(dir, 'profile-' + page + (query ? '-' + query.replace(/\W/g, '_') : ''));
const ctx = await chromium.launchPersistentContext(userDataDir, { channel: 'chromium', headless: true,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=WebGPU', '--enable-precise-memory-info'] });
const pid = (() => {
  const rows = execSync('ps -axo pid=,ppid=,command=').toString().trim().split('\n');
  const mine = rows.filter(l => l.includes('--user-data-dir=' + userDataDir) && !l.includes('--type='));
  if (mine.length !== 1) throw new Error('browser pid: ' + mine.length + ' candidates');
  return Number(mine[0].trim().split(/\s+/)[0]);
})();
const results = [];
for (const run of ['cold', 'warm']) {
  const p = await ctx.newPage();
  await p.goto('about:blank'); await new Promise(r => setTimeout(r, 1500));
  const before = rssTree(pid);
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
