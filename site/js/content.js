export const AUDIO_SENTENCES = [
  { id: 's1', text: 'I like pizza because it is delicious', file: 'frase1.mp3' },
  { id: 's2', text: 'My favorite sport is GR', file: 'frase2.mp3' },
  { id: 's3', text: 'Can you repeat what you said', file: 'frase3.mp3' },
  { id: 's4', text: 'I choose C because it is fair', file: 'frase4.mp3' },
  { id: 's5', text: 'I want to study at Astra Nova', file: 'frase5.mp3' },
];

export const EXTRA_SENTENCES = [
  { id: 'e1', text: 'I like music because it is beautiful' },
  { id: 'e2', text: 'I like soccer because it is fun' },
  { id: 'e3', text: 'I choose A because it is kind' },
];

export const ORDER_SENTENCES = [
  'I like pizza because it is delicious',
  'I choose C because it is fair',
  'I like music because it is beautiful',
  'I like soccer because it is fun',
  'I like space because it is amazing',
  'I like English because it is useful',
];

export const LISTEN_ROUNDS = [
  {
    file: 'frase1.mp3',
    answer: 'I like pizza because it is delicious',
    options: [
      'I like pizza because it is delicious',
      'I like pasta because it is delicious',
      'I like pizza because it is cold',
    ],
  },
  {
    file: 'frase2.mp3',
    answer: 'My favorite sport is GR',
    options: [
      'My favorite sport is GR',
      'My favorite sport is soccer',
      'My favorite color is blue',
    ],
  },
  {
    file: 'frase3.mp3',
    answer: 'Can you repeat what you said',
    options: [
      'Can you repeat what you said',
      'Can you repeat that later',
      'Can you speak more slowly',
    ],
  },
  {
    file: 'frase4.mp3',
    answer: 'I choose C because it is fair',
    options: [
      'I choose C because it is fair',
      'I choose A because it is fair',
      'I choose C because it is fun',
    ],
  },
  {
    file: 'frase5.mp3',
    answer: 'I want to study at Astra Nova',
    options: [
      'I want to study at Astra Nova',
      'I want to play at Astra Nova',
      'I want to study at home',
    ],
  },
];

export const DILEMMAS = [
  {
    id: 'fair',
    title: 'A vez de cada um',
    story: 'Two friends want the same turn on the computer.',
    hint: 'Dois amigos querem a mesma vez no computador.',
    options: [
      { letter: 'A', text: 'I take the long turn' },
      { letter: 'B', text: 'I skip my friend' },
      { letter: 'C', text: 'I share the turn' },
    ],
    preferred: 'C',
    example: 'I choose C because it is fair',
    audio: 'frase4.mp3',
  },
  {
    id: 'pencil',
    title: 'O lápis',
    story: 'A classmate forgot a pencil.',
    hint: 'Alguém da turma esqueceu o lápis.',
    options: [
      { letter: 'A', text: 'I share my pencil' },
      { letter: 'B', text: 'I hide my pencil' },
      { letter: 'C', text: 'I laugh' },
    ],
    preferred: 'A',
    example: 'I choose A because it is kind',
  },
  {
    id: 'hello',
    title: 'Alguém novo',
    story: 'A new student is standing alone.',
    hint: 'Tem uma pessoa nova sozinha.',
    options: [
      { letter: 'A', text: 'I say hello' },
      { letter: 'B', text: 'I walk away' },
      { letter: 'C', text: 'I stay quiet' },
    ],
    preferred: 'A',
    example: 'I choose A because it is friendly',
  },
  {
    id: 'homework',
    title: 'A tarefa',
    story: 'The homework is hard today.',
    hint: 'A tarefa de casa está difícil.',
    options: [
      { letter: 'A', text: 'I copy the answers' },
      { letter: 'B', text: 'I try by myself' },
      { letter: 'C', text: 'I hide the notebook' },
    ],
    preferred: 'B',
    example: 'I choose B because it is honest',
  },
];

export const VOCAB = [
  { prompt: '🍕', hint: 'Pizza é gostosa. Em inglês: it is…', answer: 'delicious', options: ['delicious', 'boring', 'tiny', 'angry'] },
  { prompt: '⭐', hint: 'Uma luz no céu da noite', answer: 'star', options: ['star', 'stone', 'street', 'storm'] },
  { prompt: '🤖', hint: 'A Astra está montando um…', answer: 'robot', options: ['robot', 'rabbit', 'river', 'ruler'] },
  { prompt: '🪐', hint: 'Um mundo no espaço', answer: 'planet', options: ['planet', 'plant', 'plate', 'pencil'] },
  { prompt: 'amigo', hint: 'Como se diz em inglês?', answer: 'friend', options: ['friend', 'food', 'front', 'free'] },
  { prompt: 'porque', hint: 'A palavra que explica a razão', answer: 'because', options: ['because', 'before', 'behind', 'beside'] },
  { prompt: 'escolher', hint: 'I ____ C', answer: 'choose', options: ['choose', 'chase', 'close', 'cheese'] },
  { prompt: 'justo', hint: 'I choose C because it is…', answer: 'fair', options: ['fair', 'far', 'fast', 'fall'] },
];

export function audioUrl(file) {
  return new URL(`../audio/${file}`, import.meta.url).href;
}

export function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
