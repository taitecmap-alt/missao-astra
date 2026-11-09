let audioCtx;
let toastTimer;
let confettiFrame;
let confettiStop;

export function h(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key === 'class') node.className = value;
    else node.setAttribute(key, String(value));
  });
  kids.flat().forEach((kid) => {
    if (kid == null || kid === false) return;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  });
  return node;
}

export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2600);
}

export function chime(kind) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const notes = kind === 'ok' ? [523.25, 659.25, 783.99] : [196, 164];
    notes.forEach((freq, index) => {
      osc.frequency.setValueAtTime(freq, now + index * 0.09);
    });
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch {
    // Sound is optional.
  }
}

export function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.getElementById('confetti');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  cancelAnimationFrame(confettiFrame);
  clearTimeout(confettiStop);
  canvas.hidden = false;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ['#3df0ff', '#ffd166', '#ff4ad8', '#7c6bff', '#ffffff', '#5ef2b2'];
  const bits = Array.from({ length: 70 }, () => ({
    x: Math.random() * width,
    y: -20 - Math.random() * height * 0.4,
    r: 4 + Math.random() * 6,
    vy: 2.2 + Math.random() * 3.4,
    vx: -1.5 + Math.random() * 3,
    spin: Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const started = performance.now();
  const tick = (time) => {
    ctx.clearRect(0, 0, width, height);
    bits.forEach((bit) => {
      bit.y += bit.vy;
      bit.x += bit.vx;
      bit.spin += 0.15;
      ctx.save();
      ctx.translate(bit.x, bit.y);
      ctx.rotate(bit.spin);
      ctx.fillStyle = bit.color;
      ctx.fillRect(-bit.r, -bit.r * 0.45, bit.r * 2, bit.r);
      ctx.restore();
    });
    if (time - started < 1600) confettiFrame = requestAnimationFrame(tick);
    else {
      ctx.clearRect(0, 0, width, height);
      canvas.hidden = true;
    }
  };
  confettiFrame = requestAnimationFrame(tick);
  confettiStop = setTimeout(() => {
    canvas.hidden = true;
  }, 1800);
}

export function confirmDialog({ title, body, confirmText = 'Confirmar', cancelText = 'Cancelar' }) {
  const modal = document.getElementById('modal');
  const ok = document.getElementById('modal-ok');
  const cancel = document.getElementById('modal-cancel');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = body;
  ok.textContent = confirmText;
  cancel.textContent = cancelText;
  modal.hidden = false;
  cancel.focus();
  return new Promise((resolve) => {
    const onKey = (event) => {
      if (event.key === 'Escape') finish(false);
    };
    const onBackdrop = (event) => {
      if (event.target === modal) finish(false);
    };
    const finish = (value) => {
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKey);
      modal.removeEventListener('click', onBackdrop);
      modal.hidden = true;
      resolve(value);
    };
    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKey);
    modal.addEventListener('click', onBackdrop);
  });
}

export function starsText(count) {
  const n = Math.max(0, Math.min(3, count));
  return `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`;
}
