import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {hashPassword,verifyPassword,createSessionToken,hashSessionToken,createEmailCode,digestEmailCode,safeEqualDigest} from '../server/security/credentials.js';
test('passwords use salted Argon2id and reject wrong values', async()=>{
 const p='example password 456'; const a=await hashPassword(p), b=await hashPassword(p);
 assert.match(a,/^\$argon2id\$/); assert.notEqual(a,b); assert.equal(await verifyPassword(a,p),true); assert.equal(await verifyPassword(a,'bad password'),false); await assert.rejects(hashPassword('short'));
});
test('tokens are random and email code hashes are purpose-separated',()=>{
 const a=createSessionToken(), b=createSessionToken(); assert.notEqual(a,b); assert.equal(Buffer.from(a,'base64url').length,32); assert.notEqual(hashSessionToken(a),a);
 const code=createEmailCode(), id=randomUUID(), secret='s'.repeat(40); assert.match(code,/^\d{6}$/);
 const h=digestEmailCode(secret,id,'login',code); assert(safeEqualDigest(h,digestEmailCode(secret,id,'login',code))); assert(!safeEqualDigest(h,digestEmailCode(secret,id,'reset_password',code))); assert(!safeEqualDigest(h,'00')); assert.throws(()=>digestEmailCode('short',id,'login',code));
});
