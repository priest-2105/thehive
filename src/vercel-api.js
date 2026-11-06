import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { deriveTournament, matchDefs } from './tournament.js';
import { changeTimer, freshTimer, timerSnapshot } from './timer.js';

const resultKey = 'thehive:results';
const timerKey = 'thehive:timer';
const sessionPrefix = 'thehive:session:';
const sessionSeconds = 12 * 60 * 60;
const matchIds = new Set(matchDefs.map(match => match.id));

function json(status, data, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } });
}

function storageConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(command) {
  const config = storageConfig();
  if (!config) throw new Error('Tournament storage is not configured on the server. Set the Upstash Redis REST URL and token.');
  const response = await fetch(config.url, { method: 'POST', headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' }, body: JSON.stringify(command) });
  if (!response.ok) throw new Error('Tournament storage is unavailable.');
  const data = await response.json();
  if (data.error) throw new Error('Tournament storage rejected the request.');
  return data.result;
}

async function readState() {
  const [rawResults, rawTimer] = await Promise.all([redis(['GET', resultKey]), redis(['GET', timerKey])]);
  return { results: deriveTournament(rawResults ? JSON.parse(rawResults) : {}).results, timer: rawTimer ? JSON.parse(rawTimer) : freshTimer() };
}

async function saveResults(results) { await redis(['SET', resultKey, JSON.stringify(results)]); }
async function saveTimer(timer) { await redis(['SET', timerKey, JSON.stringify(timer)]); }

function sessionToken(request) {
  return request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith('hive_session='))?.slice(13) || '';
}

async function authenticated(request) {
  const token = sessionToken(request);
  return /^[a-f0-9]{64}$/.test(token) && Boolean(await redis(['GET', `${sessionPrefix}${token}`]));
}

async function bodyOf(request) {
  const body = await request.text();
  if (body.length > 16384) throw new Error('Request is too large.');
  return JSON.parse(body || '{}');
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || new URL(origin).host === new URL(request.url).host;
}

export async function handleApi(request, route) {
  try {
    if (!storageConfig()) return json(503, { error: 'Tournament storage is not configured on Vercel. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.' });
    if (route === 'state' && request.method === 'GET') {
      const state = await readState();
      return json(200, { ...state, timer: timerSnapshot(state.timer), authenticated: await authenticated(request) });
    }
    if (!sameOrigin(request)) return json(403, { error: 'Request origin is not allowed.' });
    if (route === 'login' && request.method === 'POST') {
      const password = process.env.ADMIN_PASSWORD || '';
      if (!password) return json(503, { error: 'Set ADMIN_PASSWORD on Vercel before signing in.' });
      const body = await bodyOf(request);
      const entered = createHash('sha256').update(String(body.password || '')).digest();
      const expected = createHash('sha256').update(password).digest();
      if (!timingSafeEqual(entered, expected)) return json(401, { error: 'Incorrect password.' });
      const token = randomBytes(32).toString('hex');
      await redis(['SET', `${sessionPrefix}${token}`, '1', 'EX', sessionSeconds]);
      const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
      return json(200, { ok: true }, { 'set-cookie': `hive_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionSeconds}${secure}` });
    }
    if (route === 'logout' && request.method === 'POST') {
      const token = sessionToken(request);
      if (/^[a-f0-9]{64}$/.test(token)) await redis(['DEL', `${sessionPrefix}${token}`]);
      return json(200, { ok: true }, { 'set-cookie': 'hive_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    }
    if (!['results', 'draw', 'timer'].includes(route)) return json(404, { error: 'Not found.' });
    if (!await authenticated(request)) return json(401, { error: 'Admin sign-in required.' });
    if (route === 'results' && request.method === 'DELETE') {
      await Promise.all([saveResults({}), saveTimer(freshTimer())]);
      return json(200, { results: {} });
    }
    const state = await readState();
    if (route === 'results' && request.method === 'POST') {
      const body = await bodyOf(request);
      if (!matchIds.has(body.matchId)) return json(400, { error: 'Unknown match.' });
      const match = deriveTournament(state.results).matches.find(item => item.id === body.matchId);
      if (!match.home || !match.away) return json(400, { error: 'This matchup is waiting for earlier results.' });
      const { home, away } = body;
      if (![home, away].every(value => Number.isInteger(value) && value >= 0 && value <= 99)) return json(400, { error: 'Scores must be whole numbers from 0 to 99.' });
      const penaltyWinner = home === away ? body.penaltyWinner : null;
      if (home === away && !['home', 'away'].includes(penaltyWinner)) return json(400, { error: 'Choose the penalty winner for a draw.' });
      const results = deriveTournament({ ...state.results, [match.id]: { home, away, penaltyWinner, homeId: match.home, awayId: match.away } }).results;
      await saveResults(results);
      return json(200, { results });
    }
    if (route === 'draw' && request.method === 'POST') {
      const quarterIds = ['q1', 'q2', 'q3', 'q4'];
      if (!quarterIds.every(id => state.results[id])) return json(400, { error: 'Record all four quarter-final results before setting the semi-final pairings.' });
      const body = await bodyOf(request);
      const first = body.first;
      if (!Array.isArray(first) || first.length !== 2 || new Set(first).size !== 2 || first.some(id => !quarterIds.includes(id))) return json(400, { error: 'Choose two different quarter-final winners for semi-final 1.' });
      const results = deriveTournament({ ...state.results, _semiDraw: [...first, ...quarterIds.filter(id => !first.includes(id))] }).results;
      await saveResults(results);
      return json(200, { results });
    }
    if (route === 'timer' && request.method === 'POST') {
      const body = await bodyOf(request);
      let timer;
      if (body.action === 'select') {
        const match = deriveTournament(state.results).matches.find(item => item.id === body.matchId);
        if (!match?.home || !match?.away || state.results[match.id]) return json(400, { error: 'Select an upcoming match with both teams known.' });
        timer = freshTimer(match.id, match.round);
      } else {
        try { timer = changeTimer(state.timer, body.action); }
        catch (error) { return json(400, { error: error.message }); }
      }
      await saveTimer(timer);
      return json(200, { timer: timerSnapshot(timer) });
    }
    return json(405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('Tournament API error:', error);
    return json(503, { error: error.message === 'Request is too large.' ? error.message : 'Tournament service is unavailable. Check server configuration and try again.' });
  }
}
