'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const {DurableDelegationJournal}=require('../.delegation-build/src/delegation/durable-journal.js');
const {GuardedDelegationJournal}=require('../.delegation-build/src/delegation/guarded-journal.js');
const {canonicalSnapshot}=require('../.delegation-build/src/delegation/canonical.js');
const sha=s=>createHash('sha256').update(s).digest('hex');
const fp=a=>sha(JSON.stringify([a.actionId,a.leaseId,a.agentId,a.capability,a.scope,canonicalSnapshot(a.payload).json]));
const req=id=>({leaseId:id,principalId:'owner',agentId:'agent',capability:'local.note.append',scope:'notes',expiresAtMs:4500,maxUses:2});
const act=(id,l)=>({actionId:id,leaseId:l,agentId:'agent',capability:'local.note.append',scope:'notes',payload:{text:'valid'}});
const port=db=>({async execute(sql){db.exec(sql)},async transaction(fn){
  db.exec('BEGIN IMMEDIATE');try{const r=await fn({async get(sql,...args){return db.prepare(sql).get(...args)??null},async run(sql,...args){const s=db.prepare(sql).run(...args);return {changes:s.changes}}});db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}
}});
async function main(){
let passes=0;const test=async(name,fn)=>{await fn();passes++;console.log('PASS',name)};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mv-guarded-')),db=new DatabaseSync(path.join(dir,'state.db'));
try{
const journal=new DurableDelegationJournal(port(db),()=>1000);await journal.initialize();
const auth={
 async authenticateOwner(p){return p==='owner-auth'?{principalId:'owner'}:p==='other-owner'?{principalId:'other'}:null},
 async authenticateAgent(p){return p==='agent-auth'?{principalId:'owner',agentId:'agent'}:p==='wrong-agent'?{principalId:'owner',agentId:'wrong'}:null}
};
const consent={async approveLease(_r,p){return p==='tap'},async approveRevocation(_r,p){return p==='tap'}};
const deny={async allow(){return false}},allow={async allow(a,actor){return a.scope==='notes'&&actor.principalId==='owner'}};
const hash={async sha256(text){return sha(text)}};
const evidence={async verifyOutcome(_id,_f,outcome,p){return outcome==='EXECUTED'&&p==='trusted-receipt'}};
const guarded=new GuardedDelegationJournal(journal,auth,consent,allow,hash,evidence,()=>1000);
const gated=new GuardedDelegationJournal(journal,auth,consent,deny,hash,evidence,()=>1000);
const closed=new GuardedDelegationJournal(journal);
await test('default denial',async()=>{await assert.rejects(closed.issue(req('default'),'owner-auth','tap'),/OWNER_AUTH_FAILED/)});
await test('forged owner',async()=>{await assert.rejects(guarded.issue(req('wrong'),'other-owner','tap'),/OWNER_AUTH_FAILED/)});
await test('explicit consent needed',async()=>{await assert.rejects(guarded.issue(req('no-tap'),'owner-auth','no'),/CONSENT_REQUIRED/)});
await test('owner grant',async()=>{await guarded.issue(req('L'),'owner-auth','tap');assert.ok(await journal.getLeaseForOwner('L','owner'))});
await test('agent impersonation blocked',async()=>{await assert.rejects(guarded.reserve(act('a0','L'),'wrong-agent'),/AGENT_AUTH_FAILED/)});
await test('invalid agent blocked',async()=>{await assert.rejects(guarded.reserve(act('a0','L'),'invalid'),/AGENT_AUTH_FAILED/)});
await test('Omega denial respected',async()=>{await assert.rejects(gated.reserve(act('a1','L'),'agent-auth'),/OMEGA_DENIED/)});
await test('valid operation UNKNOWN reservation',async()=>{const r=await guarded.reserve(act('a1','L'),'agent-auth');assert.equal(r.verdict,'RESERVED');assert.equal(r.status,'UNKNOWN')});
await test('UNKNOWN duplicate held',async()=>{assert.equal((await guarded.reserve(act('a1','L'),'agent-auth')).verdict,'HOLD')});
await test('cached receipt needs authentication',async()=>{await assert.rejects(guarded.reserve(act('a1','L'),'invalid'),/AGENT_AUTH_FAILED/)});
await test('no fabricated reconciliation',async()=>{await assert.rejects(guarded.reconcile('a1',fp(act('a1','L')),'EXECUTED','bogus'),/EVIDENCE_NOT_VERIFIED/)});
await test('verified result reconciles',async()=>{await guarded.reconcile('a1',fp(act('a1','L')),'EXECUTED','trusted-receipt');assert.equal(await journal.inspect('a1'),'EXECUTED')});
await test('unowned lease cannot be revoked',async()=>{await assert.rejects(guarded.revoke('L','other-owner','tap'),/LEASE_NOT_OWNED/)});
await test('revocation requires consent',async()=>{await assert.rejects(guarded.revoke('L','owner-auth','bad'),/REVOCATION_NOT_AUTHORIZED/)});
await test('owner revocation blocks new dispatch',async()=>{await guarded.revoke('L','owner-auth','tap');assert.equal((await guarded.reserve(act('post','L'),'agent-auth')).reason,'LEASE_REVOKED')});
console.log(passes+'/'+passes+' PASS');
}finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}
}
main().catch(e=>{console.error('FAIL',e);process.exitCode=1});
