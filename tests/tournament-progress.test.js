import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTournament, teamProgress } from '../src/tournament.js';

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
