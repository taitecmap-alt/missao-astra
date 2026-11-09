import assert from 'node:assert/strict';
import {
  gradeJustification,
  normalizeSpeech,
  sameWords,
  similarity,
  voicePoints,
  wordsOf,
} from '../site/js/score.js';
import {
  applyPractice,
  countdown,
  initialState,
  levelFor,
  starsFor,
} from '../site/js/storage.js';

const target = 'I like pizza because it is delicious';
assert.equal(similarity(target, target), 1);
assert.ok(similarity("I like pizza because it's delicious", target) >= 0.95);
assert.ok(similarity('I LIKE PIZZA, because it is delicious!', target) >= 0.95);
assert.ok(similarity('I like pizza because it is delicious please', target) >= 0.9);
assert.ok(similarity('i like pizza it is delicious', target) < 0.78);
assert.ok(similarity('i like pizza it is delicious', target) >= 0.6);
assert.ok(similarity('I like pasta because it is delicious', target) < 0.78);
assert.ok(similarity('hello there', target) < 0.4);
assert.ok(similarity('My favorite sport is g r', 'My favorite sport is GR') >= 0.9);
assert.ok(similarity('I choose A because it is fair', 'I choose C because it is fair') < 0.78);
assert.equal(similarity('', target), 0);
assert.equal(voicePoints(0.95), 15);
assert.equal(voicePoints(0.7), 0);
assert.equal(normalizeSpeech("It's a test."), 'it is a test');

const fair = gradeJustification('I choose C because it is fair.');
assert.equal(fair.ok, true);
assert.equal(fair.letter, 'C');
assert.equal(gradeJustification('i choose option a because it is kind').letter, 'A');
assert.equal(gradeJustification('I choose B because fun').ok, false);
assert.equal(gradeJustification('because it is fair').ok, false);

assert.equal(sameWords(wordsOf(target), wordsOf(target)), true);
assert.equal(sameWords(['I', 'like'], wordsOf(target)), false);

let state = initialState();
const day = new Date(2026, 10, 9, 15, 0, 0);
state = applyPractice(state, { activity: 'Vocabulário', activityId: 'vocab', score: 40, max: 80 }, day);
assert.equal(state.streak, 1);
assert.equal(state.points, 40);
assert.equal(state.missionsCompleted, 1);
assert.equal(state.history.length, 1);
assert.equal(state.best.vocab, 40);
state = applyPractice(state, { activity: 'Vocabulário', activityId: 'vocab', score: 20, max: 80 }, new Date(2026, 10, 9, 20, 0, 0));
assert.equal(state.streak, 1);
assert.equal(state.points, 60);
assert.equal(state.best.vocab, 40);
state = applyPractice(state, { activity: 'Vocabulário', activityId: 'vocab', score: 80, max: 80 }, new Date(2026, 10, 10, 9, 0, 0));
assert.equal(state.streak, 2);
assert.equal(state.best.vocab, 80);
state = applyPractice(state, { activity: 'Vocabulário', activityId: 'vocab', score: 10, max: 80 }, new Date(2026, 10, 12, 9, 0, 0));
assert.equal(state.streak, 1);

assert.equal(levelFor(0), 1);
assert.equal(levelFor(100), 2);
assert.equal(levelFor(250), 3);
assert.equal(starsFor(40), 1);
assert.equal(starsFor(80), 2);

const left = countdown(new Date('2027-04-14T23:59:59-03:00'));
assert.equal(left.done, false);
assert.equal(left.days, 1);
assert.equal(left.hours, 0);
assert.equal(left.minutes, 0);
assert.equal(left.seconds, 0);

console.log('score and storage tests passed');
