import { celebrate, confirmDialog, toast } from './fx.js';
import { mountGame } from './games.js';
import { createAstraScene } from './scene.js';
import {
  countdown,
  exportPayload,
  levelTitle,
  load,
  recordSession,
  resetProgress,
  shownPoints,
  starsFor,
  levelFor,
  subscribe,
  flushVoice,
} from './storage.js';
import { flushVoicePractice, mountVoice } from './voice.js';

const views = {
  home: document.getElementById('view-home'),
  missions: document.getElementById('view-missions'),
  game: document.getElementById('view-game'),
  voice: document.getElementById('view-voice'),
  parent: document.getElementById('view-parent'),
};

let active = null;
let parentUnlocked = false;
let gateQuestion = makeQuestion();
const canvas = document.getElementById('astra-canvas');
const scene = createAstraScene(canvas, {
  onStatus(text) {
    const el = document.getElementById('astra-status');
    el.hidden = !text;
    el.textContent = text || '';
  },
  onBubble(text) {
    const el = document.getElementById('astra-bubble');
    const hint = document.getElementById('tap-hint');
    el.hidden = !text;
    el.textContent = text || '';
    if (text) hint.hidden = true;
  },
  onReady() {
    document.getElementById('stage-loading').hidden = true;
  },
  onError() {
    document.getElementById('stage-loading').hidden = true;
    document.getElementById('stage-fallback').hidden = false;
  },
});

window.__astra = {
  get ready() { return scene.debug.ready; },
  get failed() { return scene.debug.failed; },
  get error() { return scene.debug.error; },
  get clip() { return scene.debug.clip; },
  get state() { return scene.debug.state; },
  get mixerTime() { return scene.debug.mixerTime; },
  get info() { return scene.debug.info; },
  get position() { return scene.debug.position; },
  train() { scene.train(); },
};

function makeQuestion() {
  if (Math.random() < 0.5) {
    const a = 12 + Math.floor(Math.random() * 30);
    const b = 8 + Math.floor(Math.random() * 25);
    return { text: `${a} + ${b}`, answer: a + b };
  }
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 3 + Math.floor(Math.random() * 7);
  return { text: `${a} × ${b}`, answer: a * b };
}

function render(state = load()) {
  const points = shownPoints(state);
  const level = levelFor(points);
  document.getElementById('points').textContent = String(points);
  document.getElementById('stat-stars').textContent = String(starsFor(points));
  document.getElementById('stat-level').textContent = String(level);
  document.getElementById('stat-level-name').textContent = levelTitle(level);
  document.getElementById('stat-streak').textContent = String(state.streak || 0);
  document.getElementById('stat-missions').textContent = String(state.missionsCompleted || 0);
  const streakNote = document.getElementById('streak-note');
  const today = new Date();
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  streakNote.textContent = state.lastPracticeDate === key
    ? 'Você já praticou hoje. A sequência está viva.'
    : 'Pratique uma missão hoje para manter a sequência.';
  document.querySelectorAll('[data-best]').forEach((el) => {
    const id = el.getAttribute('data-best');
    const best = state.best && state.best[id];
    el.textContent = best ? `${best} pts` : 'nova';
  });
  renderHistory(state);
  renderCountdown();
}

function renderCountdown() {
  const left = countdown();
  const days = document.getElementById('cd-days');
  const label = document.getElementById('cd-days-label');
  const clock = document.getElementById('cd-clock');
  if (left.done) {
    days.textContent = '0';
    label.textContent = 'dias';
    clock.textContent = 'O prazo 15/04/2027 chegou.';
    return;
  }
  days.textContent = String(left.days);
  label.textContent = left.days === 1 ? 'dia' : 'dias';
  clock.textContent = `${left.hours}h ${String(left.minutes).padStart(2, '0')}min ${String(left.seconds).padStart(2, '0')}s`;
}

function renderHistory(state) {
  const list = document.getElementById('history');
  const empty = document.getElementById('history-empty');
  list.replaceChildren();
  const rows = state.history || [];
  empty.hidden = rows.length > 0;
  rows.forEach((row) => {
    const when = new Date(row.at);
    const stamp = Number.isNaN(when.getTime())
      ? ''
      : when.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const card = document.createElement('article');
    card.className = 'history-card';
    const title = document.createElement('strong');
    title.textContent = row.activity || 'Prática';
    const meta = document.createElement('span');
    meta.textContent = stamp;
    const score = document.createElement('b');
    const max = row.max ? ` / ${row.max}` : '';
    score.textContent = `${row.score} pontos${max}`;
    card.append(title, meta, score);
    if (row.detail) {
      const detail = document.createElement('small');
      detail.textContent = row.detail;
      card.append(detail);
    }
    list.append(card);
  });
}

function parseRoute() {
  const hash = location.hash || '#inicio';
  if (hash.startsWith('#jogo/')) return { view: 'game', game: hash.slice(6) };
  if (hash === '#missoes') return { view: 'missions' };
  if (hash === '#falar') return { view: 'voice' };
  if (hash === '#painel') return { view: 'parent' };
  return { view: 'home' };
}

function showRoute() {
  if (active) {
    active.destroy();
    active = null;
  }
  const route = parseRoute();
  Object.entries(views).forEach(([name, el]) => {
    el.hidden = name !== route.view;
  });
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    const target = btn.getAttribute('data-view');
    const on = target === route.view || (route.view === 'game' && target === 'missions');
    if (on) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
  if (route.view === 'game') {
    const root = document.getElementById('game-root');
    active = mountGame(root, {
      id: route.game,
      onDone(entry) {
        const result = recordSession(entry);
        if (entry.detail !== 'parcial') reward(result);
      },
    });
  } else if (route.view === 'voice') {
    active = mountVoice(document.getElementById('voice-root'), {
      onLevel(level) {
        toast(`Nível ${level} · ${levelTitle(level)}`);
        celebrate();
      },
    });
  } else if (route.view === 'parent') {
    renderGate();
  }
  if (route.view === 'home') scene.start();
  else scene.stop();
  scene.resize();
  window.scrollTo(0, 0);
}

function reward(result) {
  if (!result || !result.gained) return;
  const levelBit = result.leveledUp ? ` · Nível ${result.level} ${levelTitle(result.level)}` : '';
  toast(`+${result.gained} pontos${levelBit}`);
  if (result.leveledUp) celebrate();
}

function renderGate() {
  const gate = document.getElementById('parent-gate');
  const panel = document.getElementById('parent-panel');
  gate.hidden = parentUnlocked;
  panel.hidden = !parentUnlocked;
  document.getElementById('gate-label').textContent = `Quanto é ${gateQuestion.text}?`;
  document.getElementById('gate-answer').value = '';
  document.getElementById('gate-msg').hidden = true;
}

document.getElementById('gate-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = Number(String(document.getElementById('gate-answer').value).replace(',', '.'));
  const msg = document.getElementById('gate-msg');
  if (value === gateQuestion.answer) {
    parentUnlocked = true;
    renderGate();
    render();
    return;
  }
  msg.hidden = false;
  msg.textContent = 'Ainda não. Tente esta continha.';
  gateQuestion = makeQuestion();
  document.getElementById('gate-label').textContent = `Quanto é ${gateQuestion.text}?`;
  document.getElementById('gate-answer').value = '';
  document.getElementById('gate-answer').focus();
});

document.getElementById('export-btn').addEventListener('click', () => {
  flushVoice();
  const blob = new Blob([JSON.stringify(exportPayload(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'missao-astra-historico.json';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

document.getElementById('reset-btn').addEventListener('click', async () => {
  const ok = await confirmDialog({
    title: 'Apagar os dados deste aparelho?',
    body: 'Pontos, sequência e histórico saem só deste celular ou computador. Não tem cópia na internet.',
    confirmText: 'Apagar',
    cancelText: 'Cancelar',
  });
  if (!ok) return;
  resetProgress();
  toast('Dados apagados neste aparelho.');
  render();
});

window.addEventListener('hashchange', showRoute);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    scene.stop();
    flushVoicePractice();
  } else if (parseRoute().view === 'home') {
    scene.start();
  }
});
window.addEventListener('pagehide', () => {
  flushVoicePractice();
});

subscribe(() => render());
render();
showRoute();
setInterval(renderCountdown, 1000);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl).catch(() => {
      // The page still works online if the worker cannot install.
    });
  });
}
