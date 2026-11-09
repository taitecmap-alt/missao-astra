const LIGHT = new Set([
  'a', 'an', 'the', 'it', 'is', 'am', 'are', 'to', 'of', 'and', 'my', 'at', 'you', 'your',
]);

export function normalizeSpeech(raw) {
  let s = String(raw || '').toLowerCase();
  s = s.replace(/[’‘]/g, "'");
  s = s.replace(/\bit's\b/g, 'it is');
  s = s.replace(/\bi'm\b/g, 'i am');
  s = s.replace(/\bi've\b/g, 'i have');
  s = s.replace(/\bcan't\b/g, 'cannot');
  s = s.replace(/\bwon't\b/g, 'will not');
  s = s.replace(/\bdon't\b/g, 'do not');
  s = s.replace(/\blet's\b/g, 'let us');
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\b([a-z])\s+(?=[a-z]\b)/g, '$1');
  return s;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const row = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) row[j] = j;
  for (let i = 1; i <= m; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n];
}

function contentTokens(text) {
  return text.split(' ').filter((word) => word && !LIGHT.has(word));
}

export function similarity(heard, target) {
  const a = normalizeSpeech(heard);
  const b = normalizeSpeech(target);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const lev = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  const ta = a.split(' ');
  const tb = b.split(' ');
  const used = new Set();
  let hit = 0;
  for (const word of ta) {
    const index = tb.findIndex((token, i) => token === word && !used.has(i));
    if (index >= 0) {
      used.add(index);
      hit += 1;
    }
  }
  const recall = tb.length ? hit / tb.length : 0;
  const precision = ta.length ? hit / ta.length : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  let score = Math.max(lev, f1 * 0.98);
  const targetContent = contentTokens(b);
  const heardSet = new Set(contentTokens(a));
  if (targetContent.length) {
    const found = targetContent.filter((word) => heardSet.has(word)).length;
    const contentRecall = found / targetContent.length;
    if (contentRecall < 1) score = Math.min(score, 0.6 + contentRecall * 0.2);
  }
  return Math.max(0, Math.min(1, score));
}

export function bestSimilarity(alternatives, target) {
  let best = { score: 0, text: '' };
  for (const text of alternatives || []) {
    const score = similarity(text, target);
    if (score >= best.score) best = { score, text };
  }
  return best;
}

export function voiceStars(score) {
  if (score >= 0.9) return 3;
  if (score >= 0.78) return 2;
  if (score >= 0.62) return 1;
  return 0;
}

export function voicePoints(score) {
  return score >= 0.78 ? 15 : 0;
}

export function voiceFeedback(score) {
  if (score >= 0.9) return { tone: 'ok', text: 'Incrível! Ficou muito parecido.' };
  if (score >= 0.78) return { tone: 'ok', text: 'Muito bem! Eu entendi você.' };
  if (score >= 0.62) return { tone: 'almost', text: 'Quase! Ouça de novo e tente devagar.' };
  return { tone: 'almost', text: 'Ainda não ficou parecido. Ouça outra vez ou digite a frase.' };
}

export function wordsOf(sentence) {
  return String(sentence).trim().split(/\s+/);
}

export function sameWords(chosen, targetWords) {
  if (chosen.length !== targetWords.length) return false;
  return chosen.every((word, index) => word.toLowerCase() === targetWords[index].toLowerCase());
}

export function gradeJustification(raw) {
  const text = normalizeSpeech(raw);
  const match = text.match(/\bi choose (?:option |letter )?([abc])\b([\s\S]*)$/);
  if (!match) return { ok: false, reason: 'pattern' };
  const letter = match[1].toUpperCase();
  const rest = match[2] || '';
  if (!/\bbecause\b/.test(rest)) return { ok: false, reason: 'because', letter };
  const after = rest.split(/\bbecause\b/).slice(1).join('because').trim();
  const words = after.split(' ').filter(Boolean);
  if (words.length < 2) return { ok: false, reason: 'short', letter };
  return { ok: true, letter, text };
}

export function justificationHint(result) {
  if (!result || result.ok) return '';
  if (result.reason === 'because') return 'Falta o because. Tente: I choose A because it is fair.';
  if (result.reason === 'short') return 'Complete a razão: because it is …';
  return 'Tente assim: I choose A because it is kind.';
}
