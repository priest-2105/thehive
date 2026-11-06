import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordHash, readResults, readTimer, saveResults, saveTimer } from '../src/local-state.js';
import { changeTimer, freshTimer } from '../src/timer.js';

test('browser saves restore results and an accurate running clock', async () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const results = { q1: { home: 2, away: 1, homeId: 'shadow', awayId: 'mara' } };
  saveResults(storage, results);
  assert.deepEqual(readResults(storage), results);

  const timer = changeTimer(freshTimer('q1', 'quarter'), 'start', 1000);
  saveTimer(storage, timer);
  const restored = readTimer(storage, 61000);
  assert.equal(restored.status, 'running');
  assert.equal(restored.remainingMs, 540000);
  assert.equal(restored.syncedAt, 61000);

  assert.equal((await passwordHash('example-pass')).length, 64);
});
