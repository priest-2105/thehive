import React, { useEffect, useMemo, useState } from 'react';
import { deriveTournament, roundNames, teamById, teamProgress, teams, winnerOf } from './tournament.js';
import { changeTimer, freshTimer, phaseDuration, phaseLabel, timerSnapshot } from './timer.js';
import { readTimer, saveTimer, storageKeys } from './local-state.js';

const adminRoute = window.location.pathname.startsWith('/admin') || window.location.pathname === '/timer';

function Icon({ name, size = 22 }) {
  const paths = {
    fixtures: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /><path d="m9 15 2 2 4-4" /></>,
    teams: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2H3.5Z" /><path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 14a4.5 4.5 0 0 1 3 4.2V20h-3" /></>,
    matches: <><path d="M4 4h16v16H4zM4 12h16M12 4v16" /><circle cx="12" cy="12" r="2.5" /></>,
    bracket: <><path d="M4 4h6v5H4zM4 15h6v5H4zM14 9.5h6v5h-6zM10 6.5h2v5.5h2M10 17.5h2V12" /></>,
    back: <path d="m15 18-6-6 6-6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="M5 5 19 19M19 5 5 19" />,
    logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" /><path d="M14 16l4-4-4-4M18 12H8" /></>,
    timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v5l3 2M9 2h6M12 2v3" /></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function TeamMark({ team, large = false }) {
  return <span className={`team-mark ${large ? 'team-mark-large' : ''}`} style={{ '--mark-color': team.color }} aria-hidden="true">{team.short.slice(0, 2).toUpperCase()}</span>;
}

function BottomNav({ items, selected, onSelect, admin = false }) {
  return <nav className={`bottom-nav ${admin ? 'bottom-nav-admin' : ''}`} aria-label={admin ? 'Admin navigation' : 'Tournament navigation'}>
    {items.map(item => <button type="button" key={item.id} className={selected === item.id ? 'active' : ''} aria-current={selected === item.id ? 'page' : undefined} onClick={() => onSelect(item.id)}><Icon name={item.icon} size={21} /><span>{item.label}</span></button>)}
  </nav>;
}

function AppHeader({ admin = false, right }) {
  return <header className={`app-header ${admin ? 'app-header-admin' : ''}`}><div className="app-brand"><span className="hive-symbol" aria-hidden="true">H</span><span><strong>The Hive Cup</strong><small>{admin ? 'MATCH CONTROL' : '6 NOVEMBER 2026'}</small></span></div>{right}</header>;
}

function RoundHeading({ round, count }) {
  return <div className="round-heading"><h3>{round === 'final' ? 'Final' : `${roundNames[round]}s`}</h3><span>{count} {count === 1 ? 'MATCH' : 'MATCHES'}</span></div>;
}

function MatchRow({ match, results, action, compact = false }) {
  const result = results[match.id];
  const winner = winnerOf(match, results);
  const home = teamById[match.home], away = teamById[match.away];
  const ready = Boolean(home && away);
  return <article className={`match-row ${compact ? 'match-row-compact' : ''}`}>
    <div className="match-row-top"><span>{roundNames[match.round]} · {String(match.number).padStart(2, '0')}</span><span className={`match-state ${result ? 'is-final' : ready ? 'is-ready' : ''}`}>{result ? 'FULL TIME' : ready ? 'UPCOMING' : 'TBD'}</span></div>
    <div className="match-row-main">
      <div className={`match-side ${winner === match.home && winner ? 'is-winner' : ''}`}>{home && <TeamMark team={home} />}<span>{home?.short || 'Winner TBD'}</span></div>
      <div className="match-result">{result ? <><strong>{result.home} – {result.away}</strong>{result.home === result.away && <small>PEN</small>}</> : <span>vs</span>}</div>
      <div className={`match-side away ${winner === match.away && winner ? 'is-winner' : ''}`}><span>{away?.short || 'Winner TBD'}</span>{away && <TeamMark team={away} />}</div>
    </div>
    {action && <div className="match-row-action">{action}</div>}
  </article>;
}

function FixturesScreen({ matches, results }) {
  const next = matches.find(match => match.home && match.away && !results[match.id]);
  return <div className="screen-content"><div className="screen-title"><h1>Fixtures</h1><p>Friday, 6 November · Kickoff 4:30 PM</p></div>
    {next && <section className="next-fixture" aria-label="Next matchup"><div className="next-fixture-head"><span>UP NEXT</span><span>{roundNames[next.round]} {next.number}</span></div><div className="next-fixture-teams"><div><TeamMark team={teamById[next.home]} large /><strong>{teamById[next.home].short}</strong></div><span>VS</span><div><TeamMark team={teamById[next.away]} large /><strong>{teamById[next.away].short}</strong></div></div></section>}
    {['quarter', 'semi', 'final'].map(round => <section className="fixture-group" key={round}><RoundHeading round={round} count={matches.filter(match => match.round === round).length} /><div className="row-stack">{matches.filter(match => match.round === round).map(match => <MatchRow key={match.id} match={match} results={results} />)}</div></section>)}
    <RulesSummary />
  </div>;
}

function RulesSummary() {
  return <details className="rules-summary"><summary>Official match rules <Icon name="chevron" size={18} /></summary><div className="rules-body">
    <p><strong>Time:</strong> Quarter-finals are 10 minutes per half. Semi-finals and final are 8 minutes per half. Half-time is 2 minutes. The clock is strict, with no added time for the ball going out.</p>
    <p><strong>Draws:</strong> Two penalty kicks per team, then sudden death if still level. Keep the other foot close to the ball before kicking; the referee may order a retake for a violation.</p>
    <p><strong>Keepers:</strong> No handling a teammate’s pass; the opponent gets a corner. Release the ball within 8 seconds during a goal kick. A keeper foul inside the 18-yard box gives an indirect free kick.</p>
    <p><strong>On the pitch:</strong> At a corner, defenders stay inside the 18-yard box or centre circle until it is taken. Intentional handball in the area gives a penalty. Dangerous tackles and abusive conduct can be punished.</p>
    <p><strong>Cards:</strong> Yellow ₦500; red ₦1,000. Two yellows make a red. A red-carded player sits out 2 minutes and returns only with the referee’s permission. First-half fines are due at half-time; second-half fines are due immediately if the team qualifies. Unpaid fines may eliminate a team.</p>
    <p><strong>Teams:</strong> Only selected players may play. Borrowing any player, including a goalkeeper, is prohibited. Captains speak to the referee and handle discipline and fines. Captains vote for player of the tournament.</p>
  </div></details>;
}

function TeamsScreen({ onSelect }) {
  return <div className="screen-content"><div className="screen-title"><h1>Teams</h1><p>8 squads · 40 players</p></div><div className="team-list">{teams.map((team, index) => <button type="button" className="team-list-item" key={team.id} onClick={() => onSelect(team.id)}><TeamMark team={team} large /><span className="team-list-copy"><strong>{team.name}</strong><small>Captain {team.captain} · 5 players</small></span><span className="team-list-number">{String(index + 1).padStart(2, '0')}</span><Icon name="chevron" size={18} /></button>)}</div></div>;
}

function TeamDetail({ team, progress, onBack }) {
  const opponent = teamById[progress.opponentId];
  const label = progress.kind === 'upcoming' ? 'NEXT MATCH' : progress.kind === 'pending' ? 'THROUGH TO NEXT ROUND' : progress.kind === 'champion' ? 'CHAMPIONS' : progress.kind === 'runner-up' ? 'RUNNER-UP' : 'TOURNAMENT ENDED';
  const heading = progress.kind === 'upcoming' ? `vs ${opponent.short}` : progress.kind === 'pending' ? 'Opponent pending' : progress.kind === 'champion' ? 'The Hive Cup winner' : progress.kind === 'runner-up' ? `Final vs ${opponent.short}` : `Lost to ${opponent.short}`;
  const detail = progress.kind === 'pending' ? `${roundNames[progress.round]} matchup to be confirmed` : progress.kind === 'champion' ? 'Won the final' : roundNames[progress.round];
  return <div className="team-detail"><button type="button" className="back-button" onClick={onBack}><Icon name="back" size={20} /> All teams</button><div className="team-detail-head" style={{ '--team-color': team.color }}><TeamMark team={team} large /><span>THE HIVE CUP / TEAM ROSTER</span><h1>{team.name}</h1><p>Captain {team.captain}</p></div><div className="team-detail-body"><div className="detail-section-title"><h2>Squad list</h2><span>05 PLAYERS</span></div><ol>{team.players.map((player, index) => <li key={player}><span>{String(index + 1).padStart(2, '0')}</span><strong>{player}</strong>{player === team.captain && <em>CAPTAIN</em>}</li>)}</ol><div className="team-first-match"><span>{label}</span><strong>{heading}</strong><small>{detail}</small></div></div></div>;
}

function MatchesScreen({ matches, results }) {
  const completed = matches.filter(match => results[match.id]);
  return <div className="screen-content"><div className="screen-title"><h1>Matches</h1><p>{completed.length} of 7 results recorded</p></div>{completed.length ? <div className="row-stack">{completed.slice().reverse().map(match => <MatchRow key={match.id} match={match} results={results} />)}</div> : <div className="empty-state"><div className="empty-icon"><Icon name="matches" size={34} /></div><h2>No results yet</h2><p>Completed matches will appear here as the admin records scores.</p></div>}</div>;
}

function BracketCard({ match, results }) {
  const result = results[match.id], winner = winnerOf(match, results);
  return <div className="bracket-card"><div className="bracket-card-label">{roundNames[match.round]} {match.number}</div>{['home', 'away'].map(side => <div className={`bracket-team ${winner === match[side] && winner ? 'is-winner' : ''}`} key={side}><span>{match[side] ? teamById[match[side]].short : 'Winner TBD'}</span><strong>{result ? result[side] : '–'}</strong></div>)}</div>;
}

function BracketScreen({ matches, results, admin = false }) {
  const byId = Object.fromEntries(matches.map(match => [match.id, match]));
  const champion = winnerOf(byId.f1, results);
  const draw = results._semiDraw;
  const hasDraw = Array.isArray(draw) && draw.length === 4;
  return <div className="screen-content"><div className="screen-title"><h1>Bracket</h1><p>The path from eight teams to one winner</p></div>
    <div className="bracket-flow">
      {hasDraw ? [1, 2].map(side => <section className="bracket-half" key={side} aria-label={`Half ${side} of the bracket`}><div className="bracket-stage-label">QUARTER-FINAL WINNERS</div><div className="bracket-pair"><BracketCard match={byId[draw[(side - 1) * 2]]} results={results} /><BracketCard match={byId[draw[(side - 1) * 2 + 1]]} results={results} /></div><div className="branch-connector" aria-hidden="true"><span /></div><div className="bracket-stage-label">SEMI-FINAL {side}</div><BracketCard match={byId[`s${side}`]} results={results} /></section>) : <section className="bracket-undrawn"><div className="bracket-stage-label">QUARTER-FINALS</div><div className="bracket-pair"><BracketCard match={byId.q1} results={results} /><BracketCard match={byId.q2} results={results} /><BracketCard match={byId.q3} results={results} /><BracketCard match={byId.q4} results={results} /></div><div className="draw-pending"><strong>Semi-final pairings pending</strong><span>The four quarter-final winners will be paired after their results are recorded.</span></div><div className="bracket-stage-label">SEMI-FINALS</div><div className="bracket-pair"><BracketCard match={byId.s1} results={results} /><BracketCard match={byId.s2} results={results} /></div></section>}
      <div className="final-connector" aria-hidden="true"><span /></div><section className="bracket-final"><div className="bracket-stage-label">THE FINAL</div><BracketCard match={byId.f1} results={results} /></section>
      <div className={`champion-card ${champion ? 'has-champion' : ''}`}><span>CHAMPION</span><strong>{champion ? teamById[champion].name : 'To be decided'}</strong></div>
    </div>{!admin && <p className="bracket-note">The admin confirms the semi-final pairings after the quarter-finals.</p>}
  </div>;
}

function TimerScreen({ timer, matches, results, admin = false, onAction }) {
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    const refresh = () => setNow(Date.now());
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const match = matches.find(item => item.id === timer.matchId);
  const remaining = timer.status === 'running' ? Math.max(0, timer.remainingMs - (now - timer.syncedAt)) : timer.remainingMs;
  const status = timer.status === 'running' && remaining === 0 ? 'finished' : timer.status;
  const total = phaseDuration(timer.round, timer.phase);
  const minutes = String(Math.floor(Math.ceil(remaining / 1000) / 60)).padStart(2, '0');
  const seconds = String(Math.ceil(remaining / 1000) % 60).padStart(2, '0');
  const upcoming = matches.filter(item => item.home && item.away && !results[item.id]);
  async function act(action, matchId) {
    if (action === 'select' && timer.matchId && timer.matchId !== matchId && status !== 'ready' && !window.confirm('Switch matches and discard the current clock?')) return;
    if (action === 'reset' && !window.confirm('Reset this match to the first half?')) return;
    setBusy(true); setError('');
    try { await onAction(action, matchId); } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  return <div className="screen-content timer-screen"><div className="screen-title"><h1>Match timer</h1><p>Clock on this browser</p></div>
    {admin && <label className="timer-picker">Match<select value={timer.matchId || ''} onChange={event => event.target.value && act('select', event.target.value)} disabled={busy}><option value="">Choose a match</option>{upcoming.map(item => <option key={item.id} value={item.id}>{roundNames[item.round]} {item.number}: {teamById[item.home].short} vs {teamById[item.away].short}</option>)}</select></label>}
    {match ? <><section className={`timer-board ${status === 'finished' ? 'is-finished' : ''}`}><div className="timer-board-top"><span>{roundNames[match.round]} {match.number}</span><strong>{status === 'finished' ? 'TIME UP' : status.toUpperCase()}</strong></div><div className="timer-matchup"><span>{teamById[match.home]?.short || 'TBD'}</span><b>vs</b><span>{teamById[match.away]?.short || 'TBD'}</span></div><div className="timer-phase">{phaseLabel[timer.phase]}</div><div className="timer-clock" role="timer" aria-label={`${minutes} minutes ${seconds} seconds remaining`}>{minutes}<span>:</span>{seconds}</div><div className="timer-track"><span style={{ transform: `scaleX(${remaining / total})` }} /></div><div className="timer-board-foot">{timer.phase === 'break' ? '2-minute break' : `${total / 60000} minutes per half`}<span>{status === 'finished' ? timer.phase === 'second' ? 'Full time' : 'Ready for next phase' : status === 'paused' ? 'Clock paused' : 'No automatic added time'}</span></div></section>
      {admin && <div className="timer-controls">{status === 'ready' && <button type="button" className="timer-primary" disabled={busy} onClick={() => act('start')}>Start {phaseLabel[timer.phase].toLowerCase()}</button>}{status === 'running' && <button type="button" className="timer-primary" disabled={busy} onClick={() => act('pause')}>Pause clock</button>}{status === 'paused' && <button type="button" className="timer-primary" disabled={busy} onClick={() => act('resume')}>Resume clock</button>}{status === 'finished' && timer.phase !== 'second' && <button type="button" className="timer-primary" disabled={busy} onClick={() => act('next')}>Set up {timer.phase === 'first' ? 'half-time' : 'second half'}</button>}<button type="button" className="timer-reset" disabled={busy} onClick={() => act('reset')}>Reset this match</button></div>}
      {error && <p className="form-error" role="alert">{error}</p>}<p className="timer-help">The referee decides when to blow the whistle. Each phase stops at zero and waits for the admin to continue.</p></> : <div className="timer-empty"><Icon name="timer" size={36} /><h2>No match on the clock</h2><p>{admin ? 'Choose an upcoming match to prepare its first half.' : 'The admin will choose a match when play is ready.'}</p></div>}
    {!admin && <a className="timer-back" href="/">Back to fixtures</a>}
  </div>;
}

function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try { await onLogin(password); } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  return <div className="app-shell admin-shell"><AppHeader admin /><main className="login-screen"><div className="login-icon"><Icon name="lock" size={30} /></div><h1>Admin sign in</h1><p>Enter the shared admin password.</p><form onSubmit={submit}><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" disabled={busy} className="primary-button">{busy ? 'Please wait...' : 'Sign in'}</button></form><a href="/" className="plain-link">View tournament</a></main></div>;
}

function ScoreField({ label, value, onChange }) {
  return <div className="score-field"><span>{label}</span><div className="score-stepper"><button type="button" aria-label={`Decrease ${label} score`} disabled={Number(value) <= 0} onClick={() => onChange(Math.max(0, Number(value) - 1))}>−</button><input type="number" min="0" max="99" inputMode="numeric" placeholder="0" aria-label={`${label} score`} value={value} onChange={event => onChange(event.target.value)} /><button type="button" aria-label={`Increase ${label} score`} disabled={Number(value) >= 99} onClick={() => onChange(Math.min(99, Number(value) + 1))}>+</button></div></div>;
}

function ScoreSheet({ match, existing, onClose, onSave }) {
  const [home, setHome] = useState(existing?.home ?? ''), [away, setAway] = useState(existing?.away ?? '');
  const [penaltyWinner, setPenaltyWinner] = useState(existing?.penaltyWinner ?? ''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const tied = home !== '' && away !== '' && Number(home) === Number(away);
  useEffect(() => { const onKey = event => { if (event.key === 'Escape') onClose(); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [onClose]);
  async function submit(event) {
    event.preventDefault(); const h = Number(home), a = Number(away);
    if (home === '' || away === '' || !Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 99 || a > 99) return setError('Enter a score from 0 to 99 for each team.');
    if (tied && !penaltyWinner) return setError('Select the team that won on penalties.');
    setBusy(true); setError('');
    try { await onSave({ matchId: match.id, home: h, away: a, penaltyWinner: tied ? penaltyWinner : null }); onClose(); }
    catch (cause) { setError(cause.message); setBusy(false); }
  }
  return <div className="sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="score-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div className="sheet-grip" /><div className="sheet-heading"><div><small>{roundNames[match.round].toUpperCase()} · MATCH {String(match.number).padStart(2, '0')}</small><h2 id="sheet-title">{existing ? 'Edit result' : 'Record result'}</h2></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}><Icon name="close" size={22} /></button></div><form onSubmit={submit}><div className="sheet-scores"><ScoreField label={teamById[match.home].short} value={home} onChange={setHome} /><span className="sheet-vs">:</span><ScoreField label={teamById[match.away].short} value={away} onChange={setAway} /></div>{tied && <fieldset className="penalty-choice"><legend>Who won on penalties?</legend><p className="penalty-hint">Two kicks each, then sudden death if still level.</p>{['home', 'away'].map(side => <label key={side}><input type="radio" name="penaltyWinner" checked={penaltyWinner === side} onChange={() => setPenaltyWinner(side)} /><span>{teamById[match[side]].short}</span></label>)}</fieldset>}{existing && <p className="sheet-note">If this changes the winner, later results involving that team will be cleared.</p>}{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save result'}</button></form></section></div>;
}

function AdminDraw({ matches, results, onSave }) {
  const quarterIds = ['q1', 'q2', 'q3', 'q4'];
  const [selected, setSelected] = useState(results._semiDraw?.slice(0, 2) || []);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const byId = Object.fromEntries(matches.map(match => [match.id, match]));
  const remaining = quarterIds.filter(id => !selected.includes(id));
  function toggle(id) { setError(''); setSelected(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 2 ? [...current, id] : [current[1], id]); }
  async function save() {
    if (selected.length !== 2) return setError('Choose two winners for semi-final 1.');
    if ((results.s1 || results.s2 || results.f1) && !window.confirm('Changing the draw may clear recorded semi-final or final results. Continue?')) return;
    setBusy(true); setError('');
    try { await onSave(selected); } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  return <section className="admin-draw"><div className="admin-draw-heading"><span>SEMI-FINAL PAIRINGS</span><strong>{results._semiDraw ? 'Pairings set' : 'Choose the first pairing'}</strong></div><p>Select the two quarter-final winners for semi-final 1. The other two meet in semi-final 2.</p><div className="draw-options">{quarterIds.map(id => { const winner = winnerOf(byId[id], results); return <button type="button" key={id} className={selected.includes(id) ? 'is-selected' : ''} aria-pressed={selected.includes(id)} onClick={() => toggle(id)}><span>QF {byId[id].number} WINNER</span><strong>{teamById[winner]?.short || 'Pending'}</strong></button>; })}</div>{selected.length === 2 && <div className="draw-preview"><span>SF 1: {selected.map(id => teamById[winnerOf(byId[id], results)]?.short).join(' vs ')}</span><span>SF 2: {remaining.map(id => teamById[winnerOf(byId[id], results)]?.short).join(' vs ')}</span></div>}{error && <p className="form-error" role="alert">{error}</p>}<button type="button" className="primary-button" disabled={busy || selected.length !== 2} onClick={save}>{busy ? 'Saving…' : results._semiDraw ? 'Update pairings' : 'Confirm pairings'}</button></section>;
}

function AdminQueue({ matches, results, onRecord, onSaveDraw }) {
  const ready = matches.filter(match => match.home && match.away && !results[match.id]);
  const waiting = matches.filter(match => (!match.home || !match.away) && !results[match.id]);
  const quarterComplete = ['q1', 'q2', 'q3', 'q4'].every(id => results[id]);
  return <div className="screen-content"><div className="screen-title"><h1>Match queue</h1><p>{ready.length} ready to record ? {waiting.length} waiting on earlier rounds or draw</p></div>
    {ready.length ? <div className="row-stack">{ready.map(match => <MatchRow key={match.id} match={match} results={results} action={<button type="button" className="record-button" onClick={() => onRecord(match)}>Record score <Icon name="chevron" size={18} /></button>} />)}</div> : !quarterComplete || results._semiDraw ? <div className="empty-state"><div className="empty-icon"><Icon name="check" size={32} /></div><h2>All caught up</h2><p>New matches will appear after winners advance.</p></div> : null}
    {quarterComplete && <AdminDraw key={results._semiDraw?.join(',') || 'pending'} matches={matches} results={results} onSave={onSaveDraw} />}
    {waiting.length > 0 && <div className="admin-waiting"><Icon name="lock" size={18} /><span>{waiting.length} later {waiting.length === 1 ? 'match' : 'matches'} unlock as results come in</span></div>}
    <RulesSummary />
  </div>;
}

function AdminResults({ matches, results, onEdit, onClear }) {
  const completed = matches.filter(match => results[match.id]);
  return <div className="screen-content"><div className="screen-title"><h1>Results</h1><p>{completed.length} of 7 matches complete</p></div>{completed.length ? <div className="row-stack">{completed.slice().reverse().map(match => <MatchRow key={match.id} match={match} results={results} action={<button type="button" className="record-button" onClick={() => onEdit(match)}>Edit result <Icon name="chevron" size={18} /></button>} />)}</div> : <div className="empty-state"><div className="empty-icon"><Icon name="matches" size={32} /></div><h2>No scores yet</h2><p>Record the first match from the queue.</p></div>}<button type="button" className="reset-button" onClick={onClear}>Reset all results</button></div>;
}

export default function App() {
  const [results, setResults] = useState({});
  const [timer, setTimer] = useState(() => readTimer(window.localStorage));
  const [authed, setAuthed] = useState(false);
  const [loaded, setLoaded] = useState(false), [connectionError, setConnectionError] = useState('');
  const [publicTab, setPublicTab] = useState('fixtures');
  const [adminTab, setAdminTab] = useState(['/admin/timer', '/timer'].includes(window.location.pathname) ? 'timer' : 'queue');
  const [selectedTeam, setSelectedTeam] = useState(null), [editing, setEditing] = useState(null);
  const { matches } = useMemo(() => deriveTournament(results), [results]);

  useEffect(() => {
    if (window.location.pathname === '/timer') window.history.replaceState(null, '', '/admin/timer');
    function onStorage(event) {
      if (event.key === storageKeys.timer) setTimer(readTimer(window.localStorage));
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const data = await api('/state');
        if (!active) return;
        setResults(data.results);
        setAuthed(data.authenticated);
        setConnectionError('');
      } catch (error) { if (active) setConnectionError(error.message); }
      finally { if (active) setLoaded(true); }
    }
    refresh();
    const interval = window.setInterval(refresh, 10000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, []);

  function selectPublic(tab) { setSelectedTeam(null); setPublicTab(tab); window.scrollTo(0, 0); }
  function selectAdmin(tab) { setAdminTab(tab); window.history.replaceState(null, '', tab === 'timer' ? '/admin/timer' : '/admin'); window.scrollTo(0, 0); }
  async function login(password) {
    await api('/login', { method: 'POST', body: { password } });
    setAuthed(true);
  }
  async function logout() { try { await api('/logout', { method: 'POST' }); } finally { setAuthed(false); } }
  async function saveResult(payload) {
    const data = await api('/results', { method: 'POST', body: payload });
    setResults(data.results);
  }
  async function saveDraw(first) {
    const data = await api('/draw', { method: 'POST', body: { first } });
    setResults(data.results);
  }
  async function controlTimer(action, matchId) {
    let next;
    if (action === 'select') {
      const match = deriveTournament(results).matches.find(item => item.id === matchId);
      if (!match?.home || !match?.away || results[match.id]) throw new Error('Choose an upcoming match with both teams known.');
      next = freshTimer(match.id, match.round);
    } else next = changeTimer(timer, action);
    saveTimer(window.localStorage, next);
    setTimer({ ...timerSnapshot(next), syncedAt: Date.now() });
  }
  async function clearResults() {
    if (!window.confirm('Reset all tournament results for everyone and this browser’s timer?')) return;
    try { const data = await api('/results', { method: 'DELETE' }); setResults(data.results); }
    catch (error) { window.alert(error.message); return; }
    saveTimer(window.localStorage, freshTimer());
    setTimer(readTimer(window.localStorage));
  }

  if (!loaded && adminRoute) return <div className="app-loading">Loading tournament…</div>;
  if (adminRoute && !authed) return <LoginScreen onLogin={login} />;
  if (adminRoute) return <div className="app-shell admin-shell"><AppHeader admin right={<button type="button" className="header-action" onClick={logout} aria-label="Sign out"><Icon name="logout" size={21} /></button>} />{connectionError && <div className="connection-banner" role="alert">{connectionError}</div>}<main className="app-main" id="main">{adminTab === 'queue' && <AdminQueue matches={matches} results={results} onRecord={setEditing} onSaveDraw={saveDraw} />}{adminTab === 'results' && <AdminResults matches={matches} results={results} onEdit={setEditing} onClear={clearResults} />}{adminTab === 'bracket' && <BracketScreen matches={matches} results={results} admin />}{adminTab === 'timer' && <TimerScreen timer={timer} matches={matches} results={results} admin onAction={controlTimer} />}</main><BottomNav admin selected={adminTab} onSelect={selectAdmin} items={[{ id: 'queue', icon: 'fixtures', label: 'Queue' }, { id: 'results', icon: 'matches', label: 'Results' }, { id: 'bracket', icon: 'bracket', label: 'Bracket' }, { id: 'timer', icon: 'timer', label: 'Timer' }]} />{editing && <ScoreSheet key={editing.id} match={editing} existing={results[editing.id]} onClose={() => setEditing(null)} onSave={saveResult} />}</div>;
  const team = selectedTeam ? teamById[selectedTeam] : null;
  const progress = team && teamProgress(team.id, matches, results);
  return <div className="app-shell public-shell"><AppHeader right={<span className="header-status">8 TEAMS</span>} />{connectionError && <div className="connection-banner" role="alert">Live scores unavailable: {connectionError}</div>}<main className="app-main" id="main">{team ? <TeamDetail team={team} progress={progress} onBack={() => { setSelectedTeam(null); window.scrollTo(0, 0); }} /> : <>{publicTab === 'fixtures' && <FixturesScreen matches={matches} results={results} />}{publicTab === 'teams' && <TeamsScreen onSelect={id => { setSelectedTeam(id); window.scrollTo(0, 0); }} />}{publicTab === 'matches' && <MatchesScreen matches={matches} results={results} />}{publicTab === 'bracket' && <BracketScreen matches={matches} results={results} />}</>}</main><BottomNav selected={publicTab} onSelect={selectPublic} items={[{ id: 'fixtures', icon: 'fixtures', label: 'Fixtures' }, { id: 'teams', icon: 'teams', label: 'Teams' }, { id: 'matches', icon: 'matches', label: 'Matches' }, { id: 'bracket', icon: 'bracket', label: 'Bracket' }]} /></div>;
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { method: options.method || 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Tournament service returned ${response.status}.`);
  return data;
}
