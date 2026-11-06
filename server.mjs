import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync, statSync, createReadStream } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveTournament, matchDefs, winnerOf } from './src/tournament.js';
import { changeTimer, freshTimer, timerSnapshot } from './src/timer.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const envFile = resolve(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const dataFile = resolve(root, 'results.json');
const timerFile = resolve(root, 'timer.json');
const dist = resolve(root, 'dist');
const port = Number(process.env.PORT || 3001);
const password = process.env.ADMIN_PASSWORD || '';
const sessions = new Map();
const matchIds = new Set(matchDefs.map(match => match.id));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

let results = {};
try { if (existsSync(dataFile)) results = deriveTournament(JSON.parse(readFileSync(dataFile, 'utf8'))).results; }
catch (error) { console.error('Could not read results.json:', error.message); process.exit(1); }
let timer = freshTimer();
try { if (existsSync(timerFile)) timer = JSON.parse(readFileSync(timerFile, 'utf8')); }
catch (error) { console.error('Could not read timer.json:', error.message); process.exit(1); }

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(body));
}
function cookie(request) { return request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('hive_session='))?.slice(13) || ''; }
function authenticated(request) { const token = cookie(request); return token && sessions.get(token) > Date.now(); }
function persist(next) {
  const temp = `${dataFile}.tmp`;
  writeFileSync(temp, JSON.stringify(next, null, 2));
  renameSync(temp, dataFile);
  results = next;
}
function persistTimer(next) {
  const temp = `${timerFile}.tmp`;
  writeFileSync(temp, JSON.stringify(next, null, 2));
  renameSync(temp, timerFile);
  timer = next;
}
async function bodyOf(request) {
  let text = '';
  for await (const chunk of request) { text += chunk; if (text.length > 16384) throw new Error('Request too large'); }
  return JSON.parse(text || '{}');
}
function allowedOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const host = new URL(origin).host;
  return host === request.headers.host || (process.env.NODE_ENV !== 'production' && ['localhost:5173', '127.0.0.1:5173'].includes(host));
}
function serveFile(request, response) {
  if (!existsSync(dist)) return json(response, 404, { error: 'Build the site with npm run build first.' });
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const candidate = resolve(dist, `.${pathname}`);
  const file = candidate.startsWith(dist + sep) && existsSync(candidate) && statSync(candidate).isFile() ? candidate : resolve(dist, 'index.html');
  response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'x-content-type-options': 'nosniff' });
  createReadStream(file).pipe(response);
}

createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (!path.startsWith('/api/')) return serveFile(request, response);
    if (request.method === 'GET' && path === '/api/state') return json(response, 200, { results, timer: timerSnapshot(timer), authenticated: Boolean(authenticated(request)) });
    if (!allowedOrigin(request)) return json(response, 403, { error: 'Request origin is not allowed.' });
    if (request.method === 'POST' && path === '/api/login') {
      if (!password) return json(response, 503, { error: 'Set ADMIN_PASSWORD on the server before signing in.' });
      const body = await bodyOf(request);
      const entered = createHash('sha256').update(String(body.password || '')).digest();
      const expected = createHash('sha256').update(password).digest();
      if (!timingSafeEqual(entered, expected)) return json(response, 401, { error: 'Incorrect password.' });
      const token = randomBytes(32).toString('hex');
      sessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
      response.setHeader('set-cookie', `hive_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${request.socket.encrypted ? '; Secure' : ''}`);
      return json(response, 200, { ok: true });
    }
    if (request.method === 'POST' && path === '/api/logout') {
      sessions.delete(cookie(request));
      response.setHeader('set-cookie', 'hive_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      return json(response, 200, { ok: true });
    }
    if (request.method === 'POST' && path === '/api/timer') {
      if (!authenticated(request)) return json(response, 401, { error: 'Admin sign-in required.' });
      const body = await bodyOf(request);
      if (body.action === 'select') {
        const match = deriveTournament(results).matches.find(item => item.id === body.matchId);
        if (!match?.home || !match?.away || results[match.id]) return json(response, 400, { error: 'Select an upcoming match with both teams known.' });
        persistTimer(freshTimer(match.id, match.round));
      } else {
        try { persistTimer(changeTimer(timer, body.action)); }
        catch (error) { return json(response, 400, { error: error.message }); }
      }
      return json(response, 200, { timer: timerSnapshot(timer) });
    }
    if (request.method === 'POST' && path === '/api/results') {
      if (!authenticated(request)) return json(response, 401, { error: 'Admin sign-in required.' });
      const body = await bodyOf(request);
      if (!matchIds.has(body.matchId)) return json(response, 400, { error: 'Unknown match.' });
      const match = deriveTournament(results).matches.find(item => item.id === body.matchId);
      if (!match.home || !match.away) return json(response, 400, { error: 'This matchup is waiting for earlier results.' });
      const home = body.home, away = body.away;
      if (![home, away].every(value => Number.isInteger(value) && value >= 0 && value <= 99)) return json(response, 400, { error: 'Scores must be whole numbers from 0 to 99.' });
      const penaltyWinner = home === away ? body.penaltyWinner : null;
      if (home === away && !['home', 'away'].includes(penaltyWinner)) return json(response, 400, { error: 'Choose the penalty winner for a draw.' });
      const next = { ...results, [match.id]: { home, away, penaltyWinner, homeId: match.home, awayId: match.away } };
      persist(deriveTournament(next).results);
      return json(response, 200, { results });
    }
    if (request.method === 'POST' && path === '/api/draw') {
      if (!authenticated(request)) return json(response, 401, { error: 'Admin sign-in required.' });
      const quarterIds = ['q1', 'q2', 'q3', 'q4'];
      if (!quarterIds.every(id => results[id])) return json(response, 400, { error: 'Record all four quarter-final results before setting the semi-final draw.' });
      const body = await bodyOf(request);
      const first = body.first;
      if (!Array.isArray(first) || first.length !== 2 || new Set(first).size !== 2 || first.some(id => !quarterIds.includes(id))) return json(response, 400, { error: 'Choose two different quarter-final winners for semi-final 1.' });
      const remaining = quarterIds.filter(id => !first.includes(id));
      persist(deriveTournament({ ...results, _semiDraw: [...first, ...remaining] }).results);
      return json(response, 200, { results });
    }
    if (request.method === 'DELETE' && path === '/api/results') {
      if (!authenticated(request)) return json(response, 401, { error: 'Admin sign-in required.' });
      persist({}); return json(response, 200, { results });
    }
    return json(response, 404, { error: 'Not found.' });
  } catch (error) {
    console.error(error);
    json(response, 400, { error: 'Could not process the request.' });
  }
}).listen(port, () => console.log(`The Hive Cup server listening on http://localhost:${port}`));
