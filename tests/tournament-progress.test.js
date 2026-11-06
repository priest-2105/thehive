import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTournament, isFinal, teamProgress, winnerOf } from '../src/tournament.js';

function record(results, id, home, away) {
  const match = deriveTournament(results).matches.find(item => item.id === id);
  return { ...results, [id]: { home, away, homeId: match.home, awayId: match.away } };
}

test('team detail follows its current knockout matchup and final status', () => {
  let results = {};
  const progress = teamId => teamProgress(teamId, deriveTournament(results).matches, results);
  assert.deepEqual(progress('shadow'), { kind: 'upcoming', round: 'quarter', opponentId: 'mara' });

  results = record(results, 'q1', 2, 1);
  assert.deepEqual(progress('shadow'), { kind: 'pending', round: 'semi', opponentId: null });
  assert.deepEqual(progress('mara'), { kind: 'eliminated', round: 'quarter', opponentId: 'shadow' });

  results = record(results, 'q2', 2, 1);
  results = record(results, 'q3', 2, 1);
  results = record(results, 'q4', 2, 1);
  results = { ...results, _semiDraw: ['q1', 'q3', 'q2', 'q4'] };
  assert.deepEqual(progress('shadow'), { kind: 'upcoming', round: 'semi', opponentId: 'golden' });

  results = record(results, 's1', 2, 0);
  assert.deepEqual(progress('shadow'), { kind: 'pending', round: 'final', opponentId: null });
  results = record(results, 's2', 1, 0);
  assert.deepEqual(progress('shadow'), { kind: 'upcoming', round: 'final', opponentId: 'undisputed' });
  results = record(results, 'f1', 1, 0);
  assert.deepEqual(progress('shadow'), { kind: 'champion', round: 'final', opponentId: null });
  assert.deepEqual(progress('undisputed'), { kind: 'runner-up', round: 'final', opponentId: 'shadow' });
});

test('live goals can be corrected without advancing the bracket', () => {
  const q1 = deriveTournament({}).matches[0];
  let results = { q1: { home: 1, away: 0, status: 'live', homeId: q1.home, awayId: q1.away } };
  assert.equal(isFinal(results.q1), false);
  assert.equal(winnerOf(q1, results), null);
  assert.deepEqual(teamProgress('shadow', deriveTournament(results).matches, results), { kind: 'live', round: 'quarter', opponentId: 'mara' });

  results = { q1: { ...results.q1, home: 0, away: 0 } };
  assert.equal(winnerOf(q1, results), null);
  assert.equal(deriveTournament(results).matches.find(match => match.id === 's1').home, null);

  results = { q1: { ...results.q1, home: 0, away: 1, status: 'final' } };
  assert.equal(winnerOf(q1, results), 'mara');
  assert.equal(isFinal({ home: 2, away: 1 }), true); // Earlier saved scores remain final.
});

test('penalty goal totals decide a tied full-time match', () => {
  const q1 = deriveTournament({}).matches[0];
  const results = { q1: { home: 1, away: 1, status: 'final', penaltyHome: 2, penaltyAway: 1, penaltyWinner: 'away', homeId: q1.home, awayId: q1.away } };
  assert.equal(winnerOf(q1, results), 'shadow');
  assert.equal(winnerOf(q1, { q1: { ...results.q1, penaltyHome: 1, penaltyAway: 2 } }), 'mara');
  assert.equal(winnerOf(q1, { q1: { home: 1, away: 1, penaltyWinner: 'away' } }), 'mara');
});
