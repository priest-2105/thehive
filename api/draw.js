import { deriveTournament } from '../src/tournament.js';
import { handle, method, readResults, reply, requireAdmin, writeResults } from '../src/blob-api.js';

export default async function handler(req, res) {
  if (!method(req, res, ['POST']) || !requireAdmin(req, res)) return;
  await handle(res, async () => {
    const { results, etag } = await readResults();
    const first = req.body?.first;
    const quarter = ['q1', 'q2', 'q3', 'q4'];
    if (!quarter.every(id => results[id]) || !Array.isArray(first) || first.length !== 2 || new Set(first).size !== 2 || first.some(id => !quarter.includes(id))) return reply(res, 400, { error: 'Record all quarter-finals and select two winners.' });
    const next = deriveTournament({ ...results, _semiDraw: [...first, ...quarter.filter(id => !first.includes(id))] }).results;
    await writeResults(next, etag);
    reply(res, 200, { results: next });
  });
}
