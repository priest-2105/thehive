import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../src/vercel-api.js';

test('Vercel API signs in, persists results and timer, and signs out', async () => {
  const previous = { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN, password: process.env.ADMIN_PASSWORD, fetch: global.fetch };
  const store = new Map();
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  process.env.ADMIN_PASSWORD = 'test-password';
  global.fetch = async (_url, options) => {
    assert.equal(options.headers.authorization, 'Bearer test-token');
    const [action, key, value] = JSON.parse(options.body);
    if (action === 'GET') return new Response(JSON.stringify({ result: store.get(key) ?? null }));
    if (action === 'SET') { store.set(key, value); return new Response(JSON.stringify({ result: 'OK' })); }
    if (action === 'DEL') { store.delete(key); return new Response(JSON.stringify({ result: 1 })); }
    throw new Error(`Unexpected Redis command: ${action}`);
  };
  const call = (route, method = 'GET', body, cookie) => handleApi(new Request(`https://cup.example.test/api/${route}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }), route);
  try {
    assert.equal((await call('results', 'POST', { matchId: 'q1', home: 1, away: 0 })).status, 401);
    assert.equal((await call('login', 'POST', { password: 'wrong' })).status, 401);
    const login = await call('login', 'POST', { password: 'test-password' });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await (await call('state', 'GET', null, cookie)).json()).authenticated, true);
    const result = await call('results', 'POST', { matchId: 'q1', home: 2, away: 1 }, cookie);
    assert.equal(result.status, 200);
    assert.equal((await result.json()).results.q1.home, 2);
    const selected = await call('timer', 'POST', { action: 'select', matchId: 'q2' }, cookie);
    assert.equal(selected.status, 200);
    assert.equal((await selected.json()).timer.remainingMs, 600000);
    const started = await call('timer', 'POST', { action: 'start' }, cookie);
    assert.equal((await started.json()).timer.status, 'running');
    assert.equal((await (await call('state')).json()).timer.matchId, 'q2');
    assert.equal((await call('logout', 'POST', null, cookie)).status, 200);
    assert.equal((await (await call('state', 'GET', null, cookie)).json()).authenticated, false);
  } finally {
    global.fetch = previous.fetch;
    for (const [key, value] of Object.entries({ UPSTASH_REDIS_REST_URL: previous.url, UPSTASH_REDIS_REST_TOKEN: previous.token, ADMIN_PASSWORD: previous.password })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
