import test from 'node:test';
import assert from 'node:assert/strict';
import { changeTimer, freshTimer } from '../src/timer.js';

test('admin can jump phases and set remaining time without carrying over a running deadline', () => {
  const running = changeTimer(freshTimer('q1', 'quarter'), 'start', 1000);
  const breakTimer = changeTimer(running, 'jump', 2000, 'break');
  assert.deepEqual({ phase: breakTimer.phase, status: breakTimer.status, remainingMs: breakTimer.remainingMs, deadline: breakTimer.deadline }, { phase: 'break', status: 'ready', remainingMs: 120000, deadline: null });

  const second = changeTimer(breakTimer, 'jump', 3000, 'second');
  const shortened = changeTimer(second, 'seek', 4000, 95000);
  assert.equal(shortened.remainingMs, 95000);
  assert.equal(shortened.status, 'ready');
  assert.equal(changeTimer(changeTimer(shortened, 'start', 5000), 'seek', 6000, 30000).status, 'paused');
  assert.equal(changeTimer(shortened, 'seek', 6000, 0).status, 'finished');
  assert.throws(() => changeTimer(shortened, 'seek', 6000, 700000));
});
