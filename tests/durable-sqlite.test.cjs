'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const {DurableDelegationJournal}=require('../.delegation-build/src/delegation/durable-journal.js');
const {canonicalSnapshot}=require('../.delegation-build/src/delegation/canonical.js');
const sha=s=>createHash('sha256').update(s).digest('hex');
const fp=a=>sha(JSON.stringify([a.actionId,a.leaseId,a.agentId,a.capability,a.scope,canonicalSnapshot(a.payload).json]));
const lease=(id,max=2,until=5000)=>({leaseId:id,principalId:'owner',agentId:'agent',capability:'local.note.append',scope:'notes',issuedAtMs:1000,expiresAtMs:until,maxUses:max,uses:0});
const act=(id,l,txt='hello')=>({actionId:id,leaseId:l,agentId:'agent',capability:'local.note.append',scope:'notes',payload:{text:txt}});
const port=db=>({async execute(sql){db.exec(sql)},async transaction(fn){
  db.exec('BEGIN IMMEDIATE');
  try{
    const result=await fn({async run(sql,...args){const r=db.prepare(sql).run(...args);return {changes:r.changes}},async get(sql,...args){return db.prepare(sql).get(...args)??null}});
    db.exec('COMMIT');return result;
  }catch(e){db.exec('ROLLBACK');throw e}
}});
async function run(){
let now=1000,n=0;const test=async(name,fn)=>{await fn();n++;console.log('PASS',name)};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mv-durable-')),file=path.join(dir,'state.db');
let db=new DatabaseSync(file),db2=null;
try{
  db.exec('PRAGMA busy_timeout=25;PRAGMA journal_mode=WAL');
  let journal=new DurableDelegationJournal(port(db),()=>now);await journal.initialize();
  await test('grant',async()=>{await journal.grant(lease('L'));assert.equal(db.prepare('SELECT uses FROM delegation_leases WHERE lease_id=?').get('L').uses,0)});
  await test('duplicate grant',async()=>{await assert.rejects(journal.grant(lease('L')),/LEASE_DUPLICATE/)});
  await test('missing lease',async()=>{const a=act('missing','X');assert.equal((await journal.reserve(a,'owner',fp(a))).verdict,'DENIED')});
  await test('atomic reserve budget',async()=>{const a=act('A','L');assert.equal((await journal.reserve(a,'owner',fp(a))).verdict,'RESERVED');assert.equal(db.prepare('SELECT uses FROM delegation_leases WHERE lease_id=?').get('L').uses,1)});
  await test('unknown never redispatches',async()=>{const a=act('A','L');assert.equal((await journal.reserve(a,'owner',fp(a))).verdict,'HOLD')});
  await test('foreign identity cannot replay',async()=>{const a=act('A','L');assert.equal((await journal.reserve(a,'foreign',fp(a))).verdict,'DENIED')});
  await test('action collision blocked',async()=>{const a=act('A','L','changed');await assert.rejects(journal.reserve(a,'owner',fp(a)),/ACTION_ID_CONFLICT/)});
  await test('verified reconciliation',async()=>{const a=act('A','L');await journal.reconcile('A',fp(a),'EXECUTED');assert.equal(await journal.inspect('A'),'EXECUTED')});
  await test('conflicting evidence blocked',async()=>{const a=act('A','L');await assert.rejects(journal.reconcile('A',fp(a),'FAILED'),/CONFLICTING_EVIDENCE/)});
  await test('replay without additional budget',async()=>{const a=act('A','L');assert.equal((await journal.reserve(a,'owner',fp(a))).verdict,'REPLAY');assert.equal(db.prepare('SELECT uses FROM delegation_leases WHERE lease_id=?').get('L').uses,1)});
  await test('crash and reopen remains UNKNOWN',async()=>{const a=act('B','L');assert.equal((await journal.reserve(a,'owner',fp(a))).verdict,'RESERVED');db.close();db=null;db2=new DatabaseSync(file);journal=new DurableDelegationJournal(port(db2),()=>now);await journal.initialize();assert.equal((await journal.reserve(a,'owner',fp(a))).verdict,'HOLD')});
  await test('budget survives restart',async()=>{const a=act('C','L');assert.equal((await journal.reserve(a,'owner',fp(a))).reason,'BUDGET_EXHAUSTED')});
  await test('revocation survives restart',async()=>{await journal.grant(lease('REV',1));await journal.revokeForOwner('REV','owner');db2.close();db2=new DatabaseSync(file);journal=new DurableDelegationJournal(port(db2),()=>now);await journal.initialize();const a=act('postrev','REV');assert.equal((await journal.reserve(a,'owner',fp(a))).reason,'LEASE_REVOKED')});
  await test('expiration enforced',async()=>{await journal.grant(lease('EXP',1,1100));now=1100;const a=act('expired','EXP');assert.equal((await journal.reserve(a,'owner',fp(a))).reason,'LEASE_EXPIRED');now=1000});
  await test('invalid digest refused',async()=>{await assert.rejects(journal.reserve(act('bad','L'),'owner','bad'),/INVALID_RESERVATION/)});
  await test('denied operation not persisted',async()=>{const a=act('denied','L');assert.equal((await journal.reserve(a,'owner',fp(a))).verdict,'DENIED');assert.equal(db2.prepare('SELECT count(*) AS n FROM delegation_actions WHERE action_id=?').get('denied').n,0)});
  await test('two database connections cannot overspend',async()=>{
    await journal.grant(lease('ONCE',1));
    const secondDb=new DatabaseSync(file);secondDb.exec('PRAGMA busy_timeout=10');
    const second=new DurableDelegationJournal(port(secondDb),()=>now);
    const a=act('concurrent1','ONCE'),b=act('concurrent2','ONCE');
    const result=await Promise.allSettled([journal.reserve(a,'owner',fp(a)),second.reserve(b,'owner',fp(b))]);
    assert.equal(result.filter(r=>r.status==='fulfilled'&&r.value.verdict==='RESERVED').length,1);
    assert.equal(db2.prepare('SELECT uses FROM delegation_leases WHERE lease_id=?').get('ONCE').uses,1);
    secondDb.close();
  });
  console.log(n+'/'+n+' PASS');
}finally{db?.close();db2?.close();fs.rmSync(dir,{recursive:true,force:true})}
}
run().catch(e=>{console.error('FAIL',e);process.exitCode=1});
