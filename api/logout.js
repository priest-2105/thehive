import { clearCookie, method, reply } from '../src/blob-api.js';

export default function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  res.setHeader('Set-Cookie', clearCookie());
  reply(res, 200, { ok: true });
}
