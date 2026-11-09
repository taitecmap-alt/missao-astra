const KEY = 'missao-astra-v1';

export const DEADLINE = new Date('2027-04-15T23:59:59-03:00');

const listeners = new Set();

export function initialState() {
  return {
    points: 0,
    streak: 0,
    lastPracticeDate: null,
    missionsCompleted: 0,
    history: [],
    best: {},
    voiceAwardedDate: null,
    voiceAwarded: [],
    voicePending: 0,
    voiceCount: 0,
  };
}

export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(state) {
  listeners.forEach((fn) => fn(state));
}

export function load() {
  const base = initialState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const data = JSON.parse(raw);
    return {
      ...base,
      ...data,
      best: { ...base.best, ...(data.best || {}) },
      history: Array.isArray(data.history) ? data.history : [],
      voiceAwarded: Array.isArray(data.voiceAwarded) ? data.voiceAwarded : [],
      points: Number(data.points) || 0,
      streak: Number(data.streak) || 0,
      missionsCompleted: Number(data.missionsCompleted) || 0,
      voicePending: Number(data.voicePending) || 0,
      voiceCount: Number(data.voiceCount) || 0,
    };
  } catch {
    return base;
  }
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
  emit(state);
  return state;
}

export function shownPoints(state) {
  return (state.points || 0) + (state.voicePending || 0);
}

export function levelFor(points) {
  return 1 + Math.floor(Math.max(0, points) / 100);
}

export function starsFor(points) {
  return Math.floor(Math.max(0, points) / 40);
}

export function levelTitle(level) {
  if (level >= 12) return 'Estrela-guia';
  if (level >= 8) return 'Comandante';
  if (level >= 5) return 'Exploradora';
  if (level >= 3) return 'Piloto';
  return 'Cadete';
}

export function countdown(now = new Date()) {
  const ms = DEADLINE.getTime() - now.getTime();
  if (ms <= 0) return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return { done: false, days, hours, minutes, seconds };
}

export function applyPractice(state, entry, date = new Date()) {
  const today = dateKey(date);
  const yesterdayDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  const yesterday = dateKey(yesterdayDate);
  let streak = state.streak || 0;
  if (state.lastPracticeDate === today) {
    // Already practiced today.
  } else if (state.lastPracticeDate === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }
  const score = Math.max(0, Number(entry.score) || 0);
  const best = { ...state.best };
  if (entry.activityId) best[entry.activityId] = Math.max(best[entry.activityId] || 0, score);
  const history = [
    {
      at: date.toISOString(),
      activity: entry.activity,
      activityId: entry.activityId || '',
      score,
      max: entry.max ?? null,
      detail: entry.detail || '',
    },
    ...(state.history || []),
  ].slice(0, 300);
  return {
    ...state,
    points: (state.points || 0) + score,
    streak,
    lastPracticeDate: today,
    missionsCompleted: (state.missionsCompleted || 0) + 1,
    history,
    best,
  };
}

export function recordSession(entry, date = new Date()) {
  const state = load();
  const before = levelFor(shownPoints(state));
  const next = applyPractice(state, entry, date);
  save(next);
  const level = levelFor(shownPoints(next));
  return { state: next, gained: Math.max(0, Number(entry.score) || 0), leveledUp: level > before, level };
}

export function noteVoice(sentenceId, points, date = new Date()) {
  const state = load();
  const key = dateKey(date);
  const awarded = state.voiceAwardedDate === key ? [...state.voiceAwarded] : [];
  if (awarded.includes(sentenceId)) return { repeat: true, gained: 0, leveledUp: false, level: levelFor(shownPoints(state)), state };
  const gained = Math.max(0, Number(points) || 0);
  if (!gained) return { repeat: false, gained: 0, leveledUp: false, level: levelFor(shownPoints(state)), state };
  awarded.push(sentenceId);
  const before = levelFor(shownPoints(state));
  const next = {
    ...state,
    voiceAwardedDate: key,
    voiceAwarded: awarded,
    voicePending: (state.voicePending || 0) + gained,
    voiceCount: (state.voiceCount || 0) + 1,
  };
  save(next);
  const level = levelFor(shownPoints(next));
  return { repeat: false, gained, leveledUp: level > before, level, state: next };
}

export function flushVoice(date = new Date()) {
  const state = load();
  const gained = state.voicePending || 0;
  const count = state.voiceCount || 0;
  if (!gained) return { state, gained: 0, leveledUp: false, level: levelFor(shownPoints(state)) };
  const before = levelFor(shownPoints(state));
  let next = applyPractice(state, {
    activity: 'Fale com a Astra',
    activityId: 'voz',
    score: gained,
    max: null,
    detail: count === 1 ? '1 frase' : `${count} frases`,
  }, date);
  next = { ...next, voicePending: 0, voiceCount: 0 };
  save(next);
  const level = levelFor(shownPoints(next));
  return { state: next, gained, leveledUp: level > before, level };
}

export function resetProgress() {
  const fresh = initialState();
  save(fresh);
  return fresh;
}

export function exportPayload(state = load()) {
  return {
    app: 'Missão Astra',
    exportedAt: new Date().toISOString(),
    points: shownPoints(state),
    streak: state.streak,
    lastPracticeDate: state.lastPracticeDate,
    missionsCompleted: state.missionsCompleted,
    history: state.history,
    note: 'Dados locais deste aparelho. Sem nomes.',
  };
}
