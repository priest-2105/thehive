export const phaseDuration = (round, phase) => {
  if (phase === 'break') return 2 * 60 * 1000;
  return (round === 'quarter' ? 10 : 8) * 60 * 1000;
};

export const phaseLabel = { first: 'First half', break: 'Half-time', second: 'Second half' };

export function freshTimer(matchId = null, round = 'quarter') {
  return { matchId, round, phase: 'first', status: 'ready', remainingMs: phaseDuration(round, 'first'), deadline: null };
}

export function timerSnapshot(timer, now = Date.now()) {
  const remainingMs = timer.status === 'running' ? Math.max(0, timer.deadline - now) : timer.remainingMs;
  return { ...timer, remainingMs, status: timer.status === 'running' && remainingMs === 0 ? 'finished' : timer.status };
}

export function changeTimer(timer, action, now = Date.now(), value) {
  const current = timerSnapshot(timer, now);
  if (action === 'jump' && current.matchId && ['first', 'break', 'second'].includes(value)) {
    return { ...current, phase: value, status: 'ready', remainingMs: phaseDuration(current.round, value), deadline: null };
  }
  if (action === 'seek' && current.matchId && Number.isInteger(value) && value >= 0 && value <= phaseDuration(current.round, current.phase)) {
    return { ...current, status: value === 0 ? 'finished' : current.status === 'ready' ? 'ready' : 'paused', remainingMs: value, deadline: null };
  }
  if (action === 'start' && current.matchId && current.status === 'ready') return { ...current, status: 'running', deadline: now + current.remainingMs };
  if (action === 'pause' && current.status === 'running') return { ...current, status: 'paused', deadline: null };
  if (action === 'resume' && current.status === 'paused') return { ...current, status: 'running', deadline: now + current.remainingMs };
  if (action === 'next' && current.status === 'finished' && current.phase !== 'second') {
    const phase = current.phase === 'first' ? 'break' : 'second';
    return { ...current, phase, status: 'ready', remainingMs: phaseDuration(current.round, phase), deadline: null };
  }
  if (action === 'reset' && current.matchId) return freshTimer(current.matchId, current.round);
  throw new Error('This timer action is unavailable in the current state.');
}
