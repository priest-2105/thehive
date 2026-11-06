export const teams = [
  { id: 'shadow', name: 'Shadow Titan FC', short: 'Shadow Titan', captain: 'Tycoon', players: ['Tycoon', 'Saint', 'Enzo', 'Damzy', 'Dris'], color: '#d7f15b' },
  { id: 'mara', name: 'Mara Squad FC', short: 'Mara Squad', captain: 'Nonso', players: ['Nonso', 'Chag', 'Ray', 'Cstar', 'Toyosi'], color: '#efad96' },
  { id: 'undisputed', name: 'Undisputed FC', short: 'Undisputed', captain: 'Sergio BLACK', players: ['Sergio BLACK', 'Adewole', 'Mato', 'Jay', 'Splendid'], color: '#bcd7ed' },
  { id: 'shockers', name: 'Shockers FC', short: 'Shockers', captain: 'HYFIE', players: ['HYFIE', 'Tunifa', 'MM', 'Made', 'Ope'], color: '#e7ce7a' },
  { id: 'golden', name: 'Golden Eagle FC', short: 'Golden Eagle', captain: 'Yaskid', players: ['Yaskid', 'Golden Fame', 'Jago', 'Vector', 'Sam'], color: '#e8d470' },
  { id: 'tkbbj', name: 'TKBBJ FC', short: 'TKBBJ', captain: 'Jerry', players: ['Jerry', 'Tunde', 'Kula', 'Babs', 'Bailey'], color: '#c5b8ef' },
  { id: 'side', name: 'Side Hustle United', short: 'Side Hustle', captain: 'Bongo', players: ['Bongo', 'Setonji', 'Tijani', 'Fadayo', 'Holar Moor'], color: '#aadbc7' },
  { id: 'killers', name: 'Killers FC', short: 'Killers', captain: 'Shedo', players: ['Shedo', 'Lamar', 'Ibrahim', 'Pako', 'Lucky (Savage)'], color: '#e1b9ba' }
];

export const teamById = Object.fromEntries(teams.map(team => [team.id, team]));
export const matchDefs = [
  { id: 'q1', round: 'quarter', number: 1, home: 'shadow', away: 'mara' },
  { id: 'q2', round: 'quarter', number: 2, home: 'undisputed', away: 'shockers' },
  { id: 'q3', round: 'quarter', number: 3, home: 'golden', away: 'tkbbj' },
  { id: 'q4', round: 'quarter', number: 4, home: 'side', away: 'killers' },
  { id: 's1', round: 'semi', number: 1 },
  { id: 's2', round: 'semi', number: 2 },
  { id: 'f1', round: 'final', number: 1, homeFrom: 's1', awayFrom: 's2' }
];
export const roundNames = { quarter: 'Quarter-final', semi: 'Semi-final', final: 'Final' };

export function winnerOf(match, results) {
  if (!match) return null;
  const result = results[match.id];
  if (!result || !match.home || !match.away) return null;
  if (result.home > result.away) return match.home;
  if (result.away > result.home) return match.away;
  return result.penaltyWinner === 'home' ? match.home : result.penaltyWinner === 'away' ? match.away : null;
}

export function teamProgress(teamId, matches, results) {
  const played = matches.filter(match => results[match.id] && (match.home === teamId || match.away === teamId));
  const loss = played.find(match => winnerOf(match, results) !== teamId);
  if (loss) return { kind: loss.round === 'final' ? 'runner-up' : 'eliminated', round: loss.round, opponentId: loss.home === teamId ? loss.away : loss.home };
  if (played.some(match => match.round === 'final')) return { kind: 'champion', round: 'final', opponentId: null };
  const next = matches.find(match => !results[match.id] && (match.home === teamId || match.away === teamId));
  if (next) return { kind: next.home && next.away ? 'upcoming' : 'pending', round: next.round, opponentId: next.home === teamId ? next.away : next.home };
  const last = played.at(-1);
  return { kind: 'pending', round: last?.round === 'semi' ? 'final' : 'semi', opponentId: null };
}

export function deriveTournament(inputResults) {
  const results = { ...inputResults };
  const built = {};
  const quarterIds = ['q1', 'q2', 'q3', 'q4'];
  let draw = results._semiDraw;
  if (!Array.isArray(draw) || draw.length !== 4 || new Set(draw).size !== 4 || draw.some(id => !quarterIds.includes(id))) {
    draw = null;
    delete results._semiDraw;
  }
  for (const definition of matchDefs) {
    if (definition.id === 's1' && !draw && (results.s1 || results.s2)) {
      // Preserve results recorded before the semi-final draw became configurable.
      const sourceByWinner = Object.fromEntries(quarterIds.map(id => [winnerOf(built[id], results), id]));
      const first = results.s1 ? [sourceByWinner[results.s1.homeId], sourceByWinner[results.s1.awayId]] : null;
      const second = results.s2 ? [sourceByWinner[results.s2.homeId], sourceByWinner[results.s2.awayId]] : null;
      const inferred = first ? [...first, ...(second || quarterIds.filter(id => !first.includes(id)))] : second ? [...quarterIds.filter(id => !second.includes(id)), ...second] : null;
      if (inferred?.length === 4 && new Set(inferred).size === 4 && inferred.every(id => quarterIds.includes(id))) {
        draw = inferred;
        results._semiDraw = inferred;
      }
    }
    const slot = definition.id === 's1' ? 0 : definition.id === 's2' ? 2 : -1;
    const homeFrom = slot >= 0 ? draw?.[slot] : definition.homeFrom;
    const awayFrom = slot >= 0 ? draw?.[slot + 1] : definition.awayFrom;
    const home = definition.home ?? winnerOf(built[homeFrom], results);
    const away = definition.away ?? winnerOf(built[awayFrom], results);
    const match = { ...definition, home, away };
    const result = results[match.id];
    if (result && (result.homeId !== home || result.awayId !== away)) delete results[match.id];
    built[match.id] = match;
  }
  return { matches: matchDefs.map(match => built[match.id]), results };
}
