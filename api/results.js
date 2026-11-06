import { deriveTournament } from '../src/tournament.js';
import { handle, method, readResults, reply, requireAdmin, writeResults } from '../src/blob-api.js';

export default async function handler(req, res) {
  if (!method(req, res, ['POST', 'DELETE']) || !requireAdmin(req, res)) return;
  await handle(res, async () => {
    const { results, etag } = await readResults();
    if (req.method === 'DELETE') {
      await writeResults({}, etag);
      return reply(res, 200, { results: {} });
    }
    const { matchId, home, away, penaltyHome, penaltyAway, status } = req.body || {};
    const match = deriveTournament(results).matches.find(item => item.id === matchId);
    if (!match?.home || !match?.away) return reply(res, 400, { error: 'This matchup is not ready yet.' });
    if (![home, away].every(score => Number.isInteger(score) && score >= 0 && score <= 99)) return reply(res, 400, { error: 'Enter scores from 0 to 99.' });
    if (!['live', 'final'].includes(status)) return reply(res, 400, { error: 'Choose live score or full time.' });
    const shootout = status === 'final' && home === away;
    if (shootout && (![penaltyHome, penaltyAway].every(score => Number.isInteger(score) && score >= 0 && score <= 99) || penaltyHome === penaltyAway)) return reply(res, 400, { error: 'Enter different penalty goal totals for each team.' });
    if (!shootout && (penaltyHome != null || penaltyAway != null)) return reply(res, 400, { error: 'Penalty goals only apply to a final tied score.' });
    const next = deriveTournament({ ...results, [matchId]: { home, away, status, penaltyHome: shootout ? penaltyHome : null, penaltyAway: shootout ? penaltyAway : null, penaltyWinner: shootout ? (penaltyHome > penaltyAway ? 'home' : 'away') : null, homeId: match.home, awayId: match.away } }).results;
    await writeResults(next, etag);
    reply(res, 200, { results: next });
  });
}
