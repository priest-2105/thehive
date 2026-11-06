import { authorized, handle, method, readResults, reply } from '../src/blob-api.js';

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  res.setHeader('Cache-Control', 'no-store');
  await handle(res, async () => {
    const { results } = await readResults();
    reply(res, 200, { results, authenticated: authorized(req) });
  });
}
