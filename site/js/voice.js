import { AUDIO_SENTENCES, EXTRA_SENTENCES, audioUrl } from './content.js';
import { celebrate, chime, h, starsText } from './fx.js';
import { bestSimilarity, voiceFeedback, voicePoints, voiceStars } from './score.js';
import { flushVoice, noteVoice } from './storage.js';

const cache = new Map();
let flushCurrent = () => {};

export function playFile(file) {
  let audio = cache.get(file);
  if (!audio) {
    audio = new Audio(audioUrl(file));
    audio.preload = 'auto';
    cache.set(file, audio);
  }
  audio.pause();
  try {
    audio.currentTime = 0;
  } catch {
    // The file can still play from the start on the first tap.
  }
  return audio.play();
}

export function speak(text) {
  const synth = window.speechSynthesis;
  if (!synth) return false;
  const utter = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices();
  const voice = voices.find((item) => /^en-US/i.test(item.lang))
    || voices.find((item) => /^en-GB/i.test(item.lang))
    || voices.find((item) => /^en/i.test(item.lang));
  utter.lang = voice ? voice.lang : 'en-US';
  if (voice) utter.voice = voice;
  utter.rate = 0.92;
  if (synth.speaking) synth.cancel();
  synth.speak(utter);
  return true;
}

export function canListen() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function listenOnce(timeout = 8000) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return Promise.reject(new Error('unsupported'));
  return new Promise((resolve, reject) => {
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.continuous = false;
    let settled = false;
    let alts = [];
    const finish = (ok, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (ok) resolve(value);
      else reject(value);
    };
    const timer = setTimeout(() => {
      try { rec.stop(); } catch { /* already stopped */ }
      finish(false, new Error('timeout'));
    }, timeout);
    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      alts = [];
      for (let i = 0; i < last.length; i += 1) alts.push(last[i].transcript);
      if (last.isFinal) finish(true, alts);
    };
    rec.onerror = (event) => finish(false, new Error(event.error || 'mic'));
    rec.onend = () => {
      if (alts.length) finish(true, alts);
      else finish(false, new Error('no-speech'));
    };
    try {
      rec.start();
    } catch (error) {
      finish(false, error);
    }
  });
}

export function flushVoicePractice() {
  flushCurrent();
}

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
  window.speechSynthesis.getVoices();
}

export function mountVoice(container, { onLevel }) {
  const sentences = [...AUDIO_SENTENCES, ...EXTRA_SENTENCES];
  let index = 0;
  const hasMic = canListen();
  const ac = new AbortController();

  const root = h('div', { class: 'game-wrap' });
  const live = h('p', { class: 'feedback', role: 'status', 'aria-live': 'polite' });
  const sentenceEl = h('p', { class: 'say-this', lang: 'en' });
  const heard = h('p', { class: 'heard' });
  const stars = h('p', { class: 'stars-line', 'aria-hidden': 'true' });
  const field = h('textarea', {
    class: 'typing',
    lang: 'en',
    rows: '3',
    autocapitalize: 'off',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    'aria-label': 'Digite a frase em inglês',
    placeholder: 'Digite a frase aqui',
  });
  const micBtn = h('button', { type: 'button', class: 'btn primary big', 'data-act': 'mic' }, 'Falar');
  const typeBtn = h('button', { type: 'button', class: 'btn primary', 'data-act': 'type' }, 'Conferir o que digitei');
  const note = h('p', { class: 'hint' });
  note.textContent = hasMic
    ? 'Toque em Ouvir, depois em Falar, e repita a frase. Se preferir, digite.'
    : 'Este navegador não tem reconhecimento de voz. Toque em Ouvir e digite a frase.';
  if (!hasMic) micBtn.hidden = true;

  const render = () => {
    const item = sentences[index];
    sentenceEl.textContent = item.text;
    sentenceEl.setAttribute('data-target', item.text);
    stars.textContent = '';
    heard.textContent = '';
    field.value = '';
    live.className = 'feedback';
    live.textContent = '';
  };

  const gradeText = (text) => {
    const item = sentences[index];
    const score = bestSimilarity([text], item.text).score;
    const feedback = voiceFeedback(score);
    const points = voicePoints(score);
    stars.textContent = starsText(voiceStars(score));
    heard.textContent = text ? `Eu ouvi: ${text}` : '';
    if (points > 0) {
      const result = noteVoice(item.id, points);
      if (result.repeat) {
        live.className = 'feedback ok';
        live.textContent = 'Você já ganhou pontos nesta frase hoje. Pode praticar de novo!';
        chime('ok');
      } else {
        live.className = 'feedback ok';
        live.textContent = `${feedback.text} +${result.gained} pontos.`;
        chime('ok');
        celebrate();
        if (result.leveledUp && onLevel) onLevel(result.level);
      }
    } else {
      live.className = `feedback ${feedback.tone}`;
      live.textContent = feedback.text;
      if (feedback.tone !== 'ok') chime('no');
    }
  };

  root.append(
    h('h1', {}, 'Fale com a Astra'),
    note,
    h('p', { class: 'step', id: 'voice-step' }, ''),
    sentenceEl,
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn primary big', 'data-act': 'hear' }, 'Ouvir'),
      micBtn,
    ),
    stars,
    heard,
    live,
    field,
    h('div', { class: 'actions' },
      typeBtn,
      h('button', { type: 'button', class: 'btn secondary', 'data-act': 'prev' }, 'Anterior'),
      h('button', { type: 'button', class: 'btn secondary', 'data-act': 'next' }, 'Próxima'),
    ),
  );
  container.replaceChildren(root);
  const step = () => {
    root.querySelector('#voice-step').textContent = `Frase ${index + 1} de ${sentences.length}`;
  };
  render();
  step();

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const act = button.getAttribute('data-act');
    const item = sentences[index];
    if (act === 'hear') {
      if (item.file) {
        playFile(item.file).catch(() => {
          live.className = 'feedback almost';
          live.textContent = 'Não consegui tocar agora. Toque em Ouvir de novo.';
        });
      } else {
        const ok = speak(item.text);
        if (!ok) {
          live.className = 'feedback almost';
          live.textContent = 'Este navegador não leu a frase em voz alta. Leia você mesma.';
        }
      }
    } else if (act === 'mic') {
      if (!hasMic) return;
      button.disabled = true;
      live.className = 'feedback';
      live.textContent = 'Ouvindo…';
      listenOnce()
        .then((alts) => gradeText(bestSimilarity(alts, item.text).text || alts[0] || ''))
        .catch((error) => {
          live.className = 'feedback almost';
          live.textContent = micMessage(error);
          field.focus();
        })
        .finally(() => { button.disabled = false; });
    } else if (act === 'type') {
      gradeText(field.value);
    } else if (act === 'next') {
      index = (index + 1) % sentences.length;
      render();
      step();
    } else if (act === 'prev') {
      index = (index - 1 + sentences.length) % sentences.length;
      render();
      step();
    }
  }, { signal: ac.signal });

  flushCurrent = () => flushVoice();

  return {
    destroy() {
      ac.abort();
      const result = flushCurrent();
      flushCurrent = () => {};
      container.replaceChildren();
      return result;
    },
  };
}

function micMessage(error) {
  const code = String(error && error.message ? error.message : error);
  if (code.includes('not-allowed') || code.includes('service-not-allowed')) {
    return 'O microfone está bloqueado. Você pode digitar a frase.';
  }
  if (code.includes('unsupported')) return 'Sem reconhecimento de voz neste navegador. Digite a frase.';
  if (code.includes('no-speech') || code.includes('timeout')) return 'Não ouvi nada. Chegue perto do microfone ou digite.';
  return 'Não consegui ouvir. Tente de novo ou digite.';
}
