import { DILEMMAS, LISTEN_ROUNDS, ORDER_SENTENCES, VOCAB, shuffle } from './content.js';
import { celebrate, chime, h } from './fx.js';
import { gradeJustification, justificationHint, sameWords, wordsOf } from './score.js';
import { listenOnce, playFile, speak } from './voice.js';

const GAMES = {
  frase: { title: 'Monte a frase', activity: 'Monte a frase' },
  ouvir: { title: 'Ouvir e escolher', activity: 'Ouvir e escolher' },
  conundrum: { title: 'Conundrum', activity: 'Conundrum' },
  vocab: { title: 'Vocabulário', activity: 'Vocabulário' },
};

export function mountGame(container, { id, onDone }) {
  const meta = GAMES[id];
  if (!meta) {
    container.replaceChildren(h('p', {}, 'Essa missão não existe.'));
    return { destroy() {} };
  }
  const ac = new AbortController();
  const session = { score: 0, finished: false, committed: false };
  let cleanupRound = () => {};

  const finish = (done) => {
    if (session.committed) return;
    if (!done && session.score <= 0) return;
    session.committed = true;
    onDone({
      activity: meta.activity,
      activityId: id,
      score: session.score,
      max: session.max,
      detail: done ? 'rodada completa' : 'parcial',
      gained: session.score,
    });
  };

  const shell = h('div', { class: 'game-wrap' });
  const heading = h('h1', {}, meta.title);
  const help = h('p', { class: 'lede' });
  const progress = h('div', { class: 'progress', role: 'presentation' }, h('span'));
  const live = h('p', { class: 'feedback', role: 'status', 'aria-live': 'polite' });
  const body = h('div', { class: 'game-body' });
  const scoreLine = h('p', { class: 'round-score' }, 'Pontos desta missão: 0');
  shell.append(heading, help, progress, scoreLine, live, body);
  container.replaceChildren(shell);

  const setProgress = (index, total) => {
    progress.firstChild.style.width = `${Math.round((index / total) * 100)}%`;
    progress.setAttribute('aria-valuenow', String(index));
    progress.setAttribute('aria-valuemax', String(total));
  };
  const addScore = (points) => {
    session.score += points;
    scoreLine.textContent = `Pontos desta missão: ${session.score}`;
    if (points > 0) {
      chime('ok');
      celebrate();
    }
  };
  const showLive = (tone, text) => {
    live.className = `feedback ${tone || ''}`.trim();
    live.textContent = text;
  };

  if (id === 'frase') mountOrder();
  else if (id === 'ouvir') mountListen();
  else if (id === 'conundrum') mountConundrum();
  else mountVocab();

  function mountOrder() {
    help.textContent = 'Toque nas palavras na ordem certa. As frases começam com I e usam because it is.';
    const rounds = shuffle(ORDER_SENTENCES).slice(0, 5);
    session.max = rounds.length * 20;
    let index = 0;
    const show = () => {
      cleanupRound();
      const target = wordsOf(rounds[index]);
      let bank = shuffle(target.map((word, i) => ({ id: `${index}-${i}`, word })));
      if (bank.map((item) => item.word).join(' ') === target.join(' ')) bank = bank.reverse();
      const chosen = [];
      let hinted = false;
      setProgress(index, rounds.length);
      showLive('', '');
      const answer = h('div', { class: 'answer', 'data-act': 'answer' });
      const bankEl = h('div', { class: 'words' });
      const draw = () => {
        answer.replaceChildren(...(chosen.length
          ? chosen.map((item) => h('button', { type: 'button', class: 'word', 'data-act': 'undo', 'data-id': item.id }, item.word))
          : [h('span', { class: 'placeholder' }, 'A frase aparece aqui')]));
        bankEl.replaceChildren(...bank.map((item) => h('button', { type: 'button', class: 'word', 'data-act': 'take', 'data-id': item.id }, item.word)));
      };
      draw();
      const actions = h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', 'data-act': 'check' }, 'Conferir'),
        h('button', { type: 'button', class: 'btn secondary', 'data-act': 'hint' }, 'Ouvir a frase'),
      );
      body.replaceChildren(
        h('p', { class: 'step' }, `Frase ${index + 1} de ${rounds.length}`),
        answer,
        bankEl,
        actions,
      );
      const onClick = (event) => {
        const button = event.target.closest('[data-act]');
        if (!button || !body.contains(button)) return;
        const act = button.getAttribute('data-act');
        if (act === 'take') {
          const item = bank.find((entry) => entry.id === button.getAttribute('data-id'));
          if (!item) return;
          bank = bank.filter((entry) => entry !== item);
          chosen.push(item);
          draw();
        } else if (act === 'undo') {
          const item = chosen.find((entry) => entry.id === button.getAttribute('data-id'));
          if (!item) return;
          chosen.splice(chosen.indexOf(item), 1);
          bank.push(item);
          draw();
        } else if (act === 'hint') {
          hinted = true;
          speak(rounds[index]);
        } else if (act === 'check') {
          if (!chosen.length) {
            showLive('almost', 'Monte a frase primeiro.');
            return;
          }
          const ok = sameWords(chosen.map((item) => item.word), target);
          if (!ok) {
            showLive('almost', 'Quase! A frase começa com I. Tente outra ordem.');
            answer.classList.remove('shake');
            requestAnimationFrame(() => answer.classList.add('shake'));
            chime('no');
            return;
          }
          const points = hinted ? 10 : 20;
          addScore(points);
          showLive('ok', hinted ? `Certo! +${points} pontos (com a dica).` : `Certo! +${points} pontos.`);
          body.querySelectorAll('button').forEach((el) => { el.disabled = true; });
          window.setTimeout(() => {
            index += 1;
            if (index >= rounds.length) endRound();
            else show();
          }, 900);
        }
      };
      body.addEventListener('click', onClick);
      cleanupRound = () => body.removeEventListener('click', onClick);
    };
    show();
  }

  function mountListen() {
    help.textContent = 'Toque em Ouvir e escolha a frase que você escutou.';
    session.max = LISTEN_ROUNDS.length * 20;
    let index = 0;
    let played = false;
    const show = () => {
      cleanupRound();
      played = false;
      const round = LISTEN_ROUNDS[index];
      setProgress(index, LISTEN_ROUNDS.length);
      showLive('', 'Ouça primeiro.');
      const options = h('div', { class: 'choices' }, ...shuffle(round.options).map((text) => (
        h('button', { type: 'button', class: 'choice', 'data-act': 'pick', 'data-text': text, disabled: 'disabled' }, text)
      )));
      body.replaceChildren(
        h('p', { class: 'step' }, `Frase ${index + 1} de ${LISTEN_ROUNDS.length}`),
        h('button', { type: 'button', class: 'btn primary big', 'data-act': 'listen' }, 'Ouvir'),
        options,
      );
      const onClick = (event) => {
        const button = event.target.closest('[data-act]');
        if (!button || !body.contains(button)) return;
        const act = button.getAttribute('data-act');
        if (act === 'listen') {
          playFile(round.file).then(() => {
            played = true;
            options.querySelectorAll('button').forEach((el) => { el.disabled = false; });
            showLive('', 'Qual frase você ouviu?');
          }).catch(() => {
            played = true;
            options.querySelectorAll('button').forEach((el) => { el.disabled = false; });
            showLive('almost', 'O áudio não tocou. Toque em Ouvir de novo.');
          });
        } else if (act === 'pick') {
          if (!played) {
            showLive('almost', 'Ouça primeiro.');
            return;
          }
          const text = button.getAttribute('data-text');
          options.querySelectorAll('button').forEach((el) => { el.disabled = true; });
          if (text === round.answer) {
            addScore(20);
            button.classList.add('is-right');
            showLive('ok', 'Certo! +20 pontos.');
          } else {
            button.classList.add('is-wrong');
            options.querySelectorAll('button').forEach((el) => {
              if (el.getAttribute('data-text') === round.answer) el.classList.add('is-right');
            });
            showLive('almost', 'Quase! A frase certa está marcada.');
            chime('no');
          }
          window.setTimeout(() => {
            index += 1;
            if (index >= LISTEN_ROUNDS.length) endRound();
            else show();
          }, 1100);
        }
      };
      body.addEventListener('click', onClick);
      cleanupRound = () => body.removeEventListener('click', onClick);
    };
    show();
  }

  function mountConundrum() {
    help.textContent = 'Leia a situação e responda em inglês: I choose … because …';
    session.max = DILEMMAS.length * 30;
    let index = 0;
    const show = () => {
      cleanupRound();
      const item = DILEMMAS[index];
      let tries = 0;
      let assisted = false;
      let draft = '';
      setProgress(index, DILEMMAS.length);
      showLive('', 'Diga ou escreva a frase completa.');
      const field = h('textarea', {
        class: 'typing',
        lang: 'en',
        rows: '3',
        autocapitalize: 'off',
        autocomplete: 'off',
        autocorrect: 'off',
        spellcheck: 'false',
        'aria-label': 'Sua frase em inglês',
        placeholder: 'I choose A because it is kind',
      });
      const heard = h('p', { class: 'heard' });
      const choices = h('div', { class: 'choices' }, ...item.options.map((option) => (
        h('button', { type: 'button', class: 'choice', 'data-act': 'choice', 'data-letter': option.letter }, `${option.letter}. ${option.text}`)
      )));
      const actions = h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', 'data-act': 'mic' }, 'Falar'),
        h('button', { type: 'button', class: 'btn secondary', 'data-act': 'example' }, 'Ouvir exemplo'),
        h('button', { type: 'button', class: 'btn primary', 'data-act': 'submit' }, 'Enviar'),
      );
      body.replaceChildren(
        h('p', { class: 'step' }, `${index + 1} de ${DILEMMAS.length} · ${item.title}`),
        h('p', { class: 'story', lang: 'en' }, item.story),
        h('p', { class: 'hint' }, item.hint),
        choices,
        field,
        heard,
        actions,
      );
      const grade = (text) => {
        field.value = text;
        const result = gradeJustification(text);
        if (!result.ok) {
          tries += 1;
          showLive('almost', justificationHint(result));
          chime('no');
          if (tries >= 3) {
            showLive('almost', `Um jeito de dizer: ${item.example}`);
            const use = h('button', { type: 'button', class: 'btn secondary', 'data-act': 'use' }, 'Usar o exemplo');
            actions.append(use);
          }
          return;
        }
        const kind = result.letter === item.preferred;
        const points = assisted ? 10 : (kind ? 30 : 20);
        addScore(points);
        showLive('ok', kind
          ? `Mandou bem! +${points} pontos.`
          : `A frase está boa! +${points}. Se quiser, a escolha gentil é ${item.preferred}.`);
        actions.querySelectorAll('button').forEach((el) => { el.disabled = true; });
        window.setTimeout(() => {
          index += 1;
          if (index >= DILEMMAS.length) endRound();
          else show();
        }, 1200);
      };
      const onClick = async (event) => {
        const button = event.target.closest('[data-act]');
        if (!button || !body.contains(button)) return;
        const act = button.getAttribute('data-act');
        if (act === 'choice') {
          draft = `I choose ${button.getAttribute('data-letter')} because `;
          field.value = draft;
          field.focus();
          showLive('', 'Agora complete: because it is …');
        } else if (act === 'example') {
          if (item.audio) playFile(item.audio).catch(() => speak(item.example));
          else speak(item.example);
        } else if (act === 'use') {
          assisted = true;
          field.value = item.example;
          showLive('', 'Leia a frase e toque em Enviar.');
        } else if (act === 'mic') {
          button.disabled = true;
          showLive('', 'Ouvindo…');
          listenOnce()
            .then((alts) => {
              const text = alts[0] || '';
              heard.textContent = text ? `Eu ouvi: ${text}` : '';
              grade(text);
            })
            .catch((error) => {
              showLive('almost', micMessage(error));
              field.focus();
            })
            .finally(() => {
              button.disabled = false;
            });
        } else if (act === 'submit') {
          grade(field.value);
        }
      };
      body.addEventListener('click', onClick);
      cleanupRound = () => body.removeEventListener('click', onClick);
    };
    show();
  }

  function mountVocab() {
    help.textContent = 'Escolha a palavra em inglês.';
    session.max = VOCAB.length * 10;
    let index = 0;
    const show = () => {
      cleanupRound();
      const card = VOCAB[index];
      setProgress(index, VOCAB.length);
      showLive('', '');
      const options = h('div', { class: 'choices' }, ...shuffle(card.options).map((text) => (
        h('button', { type: 'button', class: 'choice', 'data-act': 'pick', 'data-text': text }, text)
      )));
      body.replaceChildren(
        h('p', { class: 'step' }, `${index + 1} de ${VOCAB.length}`),
        h('p', { class: 'vocab-prompt' }, card.prompt),
        h('p', { class: 'hint' }, card.hint),
        options,
      );
      const onClick = (event) => {
        const button = event.target.closest('[data-act="pick"]');
        if (!button || !body.contains(button)) return;
        const text = button.getAttribute('data-text');
        options.querySelectorAll('button').forEach((el) => { el.disabled = true; });
        if (text === card.answer) {
          addScore(10);
          button.classList.add('is-right');
          showLive('ok', 'Certo! +10 pontos.');
        } else {
          button.classList.add('is-wrong');
          options.querySelectorAll('button').forEach((el) => {
            if (el.getAttribute('data-text') === card.answer) el.classList.add('is-right');
          });
          showLive('almost', `A palavra é ${card.answer}.`);
          chime('no');
        }
        window.setTimeout(() => {
          index += 1;
          if (index >= VOCAB.length) endRound();
          else show();
        }, 900);
      };
      body.addEventListener('click', onClick);
      cleanupRound = () => body.removeEventListener('click', onClick);
    };
    show();
  }

  function endRound() {
    session.finished = true;
    setProgress(session.max ? 1 : 1, 1);
    progress.firstChild.style.width = '100%';
    showLive('ok', `Missão completa! Você ganhou ${session.score} pontos.`);
    body.replaceChildren(
      h('p', { class: 'story' }, 'A Astra anotou esta missão no seu painel.'),
      h('a', { class: 'btn primary', href: '#missoes' }, 'Voltar às missões'),
    );
    finish(true);
  }

  return {
    destroy() {
      ac.abort();
      cleanupRound();
      if (!session.finished) finish(false);
      container.replaceChildren();
    },
  };
}

function micMessage(error) {
  const code = String(error && error.message ? error.message : error);
  if (code.includes('not-allowed') || code.includes('service-not-allowed')) {
    return 'O microfone está bloqueado. Você pode digitar a frase.';
  }
  if (code.includes('unsupported')) return 'Sem reconhecimento de voz neste navegador. Digite a frase.';
  return 'Não consegui ouvir. Tente de novo ou digite.';
}
