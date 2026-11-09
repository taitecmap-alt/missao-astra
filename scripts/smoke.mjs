import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve('site');
const HOST = '127.0.0.1';
const PORT = 8765;
const BASE = '/missao-astra';
const shots = path.resolve('/tmp/shots');
fs.mkdirSync(shots, { recursive: true });

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg',
};

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === BASE || pathname === `${BASE}/`) pathname = `${BASE}/index.html`;
    if (!pathname.startsWith(`${BASE}/`)) {
      res.writeHead(404);
      res.end('use the project path');
      return;
    }
    pathname = pathname.slice(BASE.length).replace(/^\/+/, '');
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.normalize(path.join(ROOT, pathname));
    if (!file.startsWith(`${ROOT}${path.sep}`) && file !== ROOT) {
      res.writeHead(403);
      res.end('no');
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const ext = path.extname(file);
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(PORT, HOST, () => resolve(server));
  });
}

function track(page, bucket) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') bucket.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (error) => bucket.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (req) => {
    const failure = req.failure();
    bucket.push(`requestfailed: ${req.url()} ${failure ? failure.errorText : ''}`);
  });
}

async function waitReady(page) {
  await page.waitForFunction(() => window.__astra && (window.__astra.ready || window.__astra.failed), { timeout: 25000 });
  const info = await page.evaluate(() => window.__astra);
  if (!info.ready) throw new Error(`Astra failed: ${info.error || 'unknown'}`);
  return info;
}

const server = await startServer();
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ],
});

const errors = [];
try {
  const page = await browser.newPage();
  track(page, errors);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await page.goto(`http://${HOST}:${PORT}${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const info = await waitReady(page);
  console.log('model', JSON.stringify(info.info));
  console.log('state', info.state, 'clip', info.clip);
  const t1 = info.mixerTime;
  await new Promise((resolve) => setTimeout(resolve, 800));
  const mid = await page.evaluate(() => ({ t: window.__astra.mixerTime, state: window.__astra.state, clip: window.__astra.clip }));
  if (!(mid.t > t1 + 0.05)) throw new Error(`mixer did not advance (${t1} -> ${mid.t})`);
  await page.screenshot({ path: path.join(shots, 'mobile-home.png') });

  const box = await page.$('#astra-canvas');
  const rect = await box.boundingBox();
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height * 0.42);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const afterTap = await page.evaluate(() => ({
    state: window.__astra.state,
    bubble: document.getElementById('astra-bubble').textContent,
    hidden: document.getElementById('astra-bubble').hidden,
  }));
  console.log('after tap', JSON.stringify(afterTap));
  if (afterTap.state !== 'greet' && afterTap.hidden) throw new Error('tap did not make Astra react');
  await page.screenshot({ path: path.join(shots, 'mobile-greet.png') });
  await page.evaluate(() => window.__astra.train());
  await new Promise((resolve) => setTimeout(resolve, 500));
  const kick = await page.evaluate(() => ({
    state: window.__astra.state,
    clip: window.__astra.clip,
    status: document.getElementById('astra-status').textContent,
  }));
  console.log('kick', JSON.stringify(kick));
  if (kick.clip !== 'fight') throw new Error(`expected fight clip, got ${kick.clip}`);
  await page.screenshot({ path: path.join(shots, 'mobile-kick.png') });

  await page.click('a[href="#missoes"]');
  await page.waitForSelector('a[href="#jogo/ouvir"]');
  await page.screenshot({ path: path.join(shots, 'mobile-missions.png') });
  await page.click('a[href="#jogo/ouvir"]');
  await page.waitForSelector('[data-act="listen"]');
  await page.click('[data-act="listen"]');
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-act="pick"]');
    return button && !button.disabled;
  }, { timeout: 8000 });
  await page.click('button[data-text="I like pizza because it is delicious"]');
  await page.waitForFunction(() => /Certo/.test(document.querySelector('.feedback')?.textContent || ''));
  await page.screenshot({ path: path.join(shots, 'mobile-listen.png') });

  await page.click('a[href="#falar"]');
  await page.waitForSelector('[data-target]');
  const said = await page.$eval('[data-target]', (el) => el.getAttribute('data-target'));
  await page.type('textarea.typing', said);
  await page.click('[data-act="type"]');
  await page.waitForFunction(() => /pontos|parecido|entendi/i.test(document.querySelector('.feedback')?.textContent || ''));
  await page.screenshot({ path: path.join(shots, 'mobile-voice.png') });

  await page.click('a[href="#painel"]');
  await page.waitForFunction(() => /\d/.test(document.querySelector('#gate-label')?.textContent || ''));
  const label = await page.$eval('#gate-label', (el) => el.textContent);
  const match = label.match(/(\d+)\s*([+×x])\s*(\d+)/i);
  if (!match) throw new Error(`could not read gate: ${label}`);
  const answer = match[2] === '+' ? Number(match[1]) + Number(match[3]) : Number(match[1]) * Number(match[3]);
  await page.type('#gate-answer', String(answer));
  await page.click('#gate-form button[type="submit"]');
  await page.waitForSelector('#parent-panel:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('.history-card').length >= 1);
  await page.screenshot({ path: path.join(shots, 'mobile-parent.png') });

  const swReady = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return Boolean(reg.active);
  });
  if (!swReady) throw new Error('service worker did not activate');

  await page.setViewport({ width: 1280, height: 800, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  await page.goto(`http://${HOST}:${PORT}${BASE}/#inicio`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await new Promise((resolve) => setTimeout(resolve, 600));
  await page.screenshot({ path: path.join(shots, 'desktop-home.png') });

  const serious = errors.filter((line) => !/favicon/i.test(line));
  if (serious.length) {
    console.error(serious.join('\n'));
    throw new Error(`${serious.length} console/network errors`);
  }
  console.log('smoke ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
