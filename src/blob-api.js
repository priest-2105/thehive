import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { deriveTournament } from './tournament.js';

const path = 'thehive-results.json';
const cookieName = 'hive_session';
const sessionMs = 12 * 60 * 60 * 1000;

export function reply(res, status, data) { res.status(status).json(data); }
export function method(req, res, allowed) {
  if (allowed.includes(req.method)) return true;
  res.setHeader('Allow', allowed.join(', '));
  reply(res, 405, { error: 'Method not allowed.' });
  return false;
}
export function configured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Connect a private Vercel Blob store to this project.');
}
export function passwordConfigured() {
  if (!process.env.ADMIN_PASSWORD) throw new Error('Set ADMIN_PASSWORD in Vercel Environment Variables.');
}
function signature(value) { return createHmac('sha256', process.env.ADMIN_PASSWORD).update(value).digest('hex'); }
function equal(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function verifyPassword(value) {
  passwordConfigured();
  if (typeof value !== 'string') return false;
  return equal(createHash('sha256').update(value).digest('hex'), createHash('sha256').update(process.env.ADMIN_PASSWORD).digest('hex'));
}
export function sessionCookie(req) {
  const value = `${Date.now()}.${randomBytes(12).toString('hex')}`;
  return `${cookieName}=${value}.${signature(value)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionMs / 1000}${req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`;
}
export function clearCookie() { return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`; }
export function authorized(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const cookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`));
  const parts = cookie?.slice(cookieName.length + 1).split('.');
  if (!parts || parts.length !== 3) return false;
  const [time, nonce, mac] = parts;
  const age = Date.now() - Number(time);
  return Number.isFinite(age) && age >= 0 && age < sessionMs && /^[a-f0-9]{24}$/.test(nonce) && equal(mac, signature(`${time}.${nonce}`));
}
export function requireAdmin(req, res) {
  passwordConfigured();
  if (authorized(req)) return true;
  reply(res, 401, { error: 'Sign in to manage results.' });
  return false;
}
export async function readResults() {
  configured();
  const file = await get(path, { access: 'private', useCache: false });
  if (!file) return { results: {}, etag: null };
  const stored = await new Response(file.stream).json();
  return { results: deriveTournament(stored.results || {}).results, etag: file.blob.etag };
}
export async function writeResults(results, etag) {
  await put(path, JSON.stringify({ results, updatedAt: new Date().toISOString() }), {
    access: 'private', allowOverwrite: true, ...(etag ? { ifMatch: etag } : {}), contentType: 'application/json', cacheControlMaxAge: 60
  });
}
export async function handle(res, task) {
  try { await task(); }
  catch (error) {
    const status = /^(Connect a private|Set ADMIN_PASSWORD)/.test(error.message) ? 503 : error.name === 'BlobPreconditionFailedError' ? 409 : 500;
    reply(res, status, { error: status === 409 ? 'Results changed on another device. Refresh and try again.' : status === 500 ? 'Could not reach tournament storage. Try again.' : error.message });
  }
}
