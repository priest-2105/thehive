import { handle, method, reply, sessionCookie, verifyPassword } from '../src/blob-api.js';

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  await handle(res, async () => {
    if (!verifyPassword(req.body?.password)) return reply(res, 401, { error: 'Incorrect admin password.' });
    res.setHeader('Set-Cookie', sessionCookie(req));
    reply(res, 200, { ok: true });
  });
}
