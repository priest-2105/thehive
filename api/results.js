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
    const { matchId, home, away, penaltyWinner, status } = req.body || {};
    const match = deriveTournament(results).matches.find(item => item.id === matchId);
    if (!match?.home || !match?.away) return reply(res, 400, { error: 'This matchup is not ready yet.' });
    if (![home, away].every(score => Number.isInteger(score) && score >= 0 && score <= 99)) return reply(res, 400, { error: 'Enter scores from 0 to 99.' });
    if (!['live', 'final'].includes(status)) return reply(res, 400, { error: 'Choose live score or full time.' });
    if (status === 'final' && home === away && !['home', 'away'].includes(penaltyWinner)) return reply(res, 400, { error: 'Select the penalty winner before marking a draw full time.' });
    if ((status === 'live' || home !== away) && penaltyWinner != null) return reply(res, 400, { error: 'Penalties only apply to a final tied score.' });
    const next = deriveTournament({ ...results, [matchId]: { home, away, status, penaltyWinner: status === 'final' && home === away ? penaltyWinner : null, homeId: match.home, awayId: match.away } }).results;
    await writeResults(next, etag);
    reply(res, 200, { results: next });
  });
}
