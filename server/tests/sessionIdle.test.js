import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionIsIdle,SESSION_IDLE_MS} from '../src/utils/sessionIdlePolicy.js';
import {idleExpired} from '../../client/src/utils/sessionPolicy.js';
test('client and server lock at thirty-minute boundary including sleep and clock-invalid values',()=>{
 const now=Date.parse('2026-10-11T12:00:00Z');
 for(const elapsed of [0,SESSION_IDLE_MS-1,SESSION_IDLE_MS,SESSION_IDLE_MS+100000]){
  const last=now-elapsed;assert.equal(idleExpired(last,now),elapsed>=SESSION_IDLE_MS);assert.equal(sessionIsIdle(new Date(last),null,now),elapsed>=SESSION_IDLE_MS);
 }
 assert.equal(idleExpired(NaN,now),true);assert.equal(idleExpired(now+1,now),true);
 assert.equal(sessionIsIdle('bad',null,now),true);assert.equal(sessionIsIdle(null,(now-SESSION_IDLE_MS)/1000,now),true);
 assert.equal(sessionIsIdle(null,(now-1000)/1000,now),false);
});
