import argon2 from 'argon2';
import { randomBytes, randomInt, createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Building blocks only: no routes use these yet. Never log passwords, tokens or codes.
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 1024) throw new Error('Invalid password length');
  return argon2.hash(password, {type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1});
}
export async function verifyPassword(hash, password) {
  if (typeof hash !== 'string' || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 1024) return false;
  try { return await argon2.verify(hash, password); } catch { return false; }
}
export function createSessionToken() { return randomBytes(32).toString('base64url'); }
export function hashSessionToken(token) { return createHash('sha256').update(token, 'utf8').digest('hex'); }
export function createEmailCode() { return String(randomInt(0, 1000000)).padStart(6, '0'); }
export function digestEmailCode(secret, challengeId, purpose, code) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) throw new Error('Code key must have at least 32 bytes');
  if (!/^[0-9]{6}$/.test(code) || !/^[a-z_]+$/.test(purpose) || !/^[0-9a-f-]{36}$/.test(challengeId)) throw new Error('Invalid challenge');
  return createHmac('sha256', secret).update(JSON.stringify([challengeId, purpose, code])).digest('hex');
}
export function safeEqualDigest(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
