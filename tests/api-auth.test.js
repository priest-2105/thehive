import test from 'node:test';
import assert from 'node:assert/strict';
import login from '../api/login.js';
import logout from '../api/logout.js';
import { authorized } from '../src/blob-api.js';

function response() {
  return {
    headers: {}, statusCode: 200, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('only the server password creates a valid, revocable admin cookie', async () => {
  const previous = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = 'test-only-password';
  try {
    const bad = response();
    await login({ method: 'POST', body: { password: 'wrong' }, headers: {} }, bad);
    assert.equal(bad.statusCode, 401);
    assert.equal(bad.headers['Set-Cookie'], undefined);

    const good = response();
    await login({ method: 'POST', body: { password: 'test-only-password' }, headers: { 'x-forwarded-proto': 'https' } }, good);
    assert.equal(good.statusCode, 200);
    assert.match(good.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/);
    assert.match(good.headers['Set-Cookie'], /Secure/);
    const cookie = good.headers['Set-Cookie'].split(';')[0];
    assert.equal(authorized({ headers: { cookie } }), true);
    assert.equal(authorized({ headers: { cookie: `${cookie.slice(0, -1)}${cookie.endsWith('0') ? '1' : '0'}` } }), false);

    const out = response();
    logout({ method: 'POST' }, out);
    assert.match(out.headers['Set-Cookie'], /Max-Age=0/);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previous;
  }
});
