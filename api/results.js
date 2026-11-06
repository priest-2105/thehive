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
    const { matchId, home, away, penaltyWinner } = req.body || {};
    const match = deriveTournament(results).matches.find(item => item.id === matchId);
    if (!match?.home || !match?.away) return reply(res, 400, { error: 'This matchup is not ready yet.' });
    if (![home, away].every(score => Number.isInteger(score) && score >= 0 && score <= 99)) return reply(res, 400, { error: 'Enter scores from 0 to 99.' });
    if (home === away ? !['home', 'away'].includes(penaltyWinner) : penaltyWinner != null) return reply(res, 400, { error: 'Select a penalty winner only for a tied match.' });
    const next = deriveTournament({ ...results, [matchId]: { home, away, penaltyWinner: home === away ? penaltyWinner : null, homeId: match.home, awayId: match.away } }).results;
    await writeResults(next, etag);
    reply(res, 200, { results: next });
  });
}
