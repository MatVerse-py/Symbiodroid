'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {DurableDelegationJournal}=require('../.delegation-build/src/delegation/durable-journal.js');
const {readDelegationReadiness,DELEGATION_DATABASE_NAME}=require('../.delegation-build/src/delegation/readiness.js');
const {canonicalSnapshot}=require('../.delegation-build/src/delegation/canonical.js');

const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const fingerprint=a=>hash(JSON.stringify([a.actionId,a.leaseId,a.agentId,a.capability,a.scope,canonicalSnapshot(a.payload).json]));
const lease=(id,expiration=4000)=>({leaseId:id,principalId:'owner',agentId:'agent',scope:'notes',capability:'local.note.append',issuedAtMs:1000,expiresAtMs:expiration,maxUses:8,uses:0});
const action=(id,l)=>({actionId:id,leaseId:l,agentId:'agent',scope:'notes',capability:'local.note.append',payload:{text:'CONFIDENTIAL_SIMULATED_PAYLOAD'}});
const port=db=>({
 async execute(sql){db.exec(sql)},
 async transaction(task){
  db.exec('BEGIN IMMEDIATE');
  try {const result=await task({
    async get(sql,...args){return db.prepare(sql).get(...args)??null},
    async run(sql,...args){const q=db.prepare(sql).run(...args);return {changes:q.changes}}
   });db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e}
 }
});
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mv-readiness-'));const db=new DatabaseSync(path.join(dir,'readiness.db'));
 let now=1000,count=0;
 const test=async(name,fn)=>{await fn();count++;console.log('PASS',name)};
 try{
  const connection=port(db),j=new DurableDelegationJournal(connection,()=>now);
  await j.initialize();
  await test('stable isolated database namespace',async()=>assert.equal(DELEGATION_DATABASE_NAME,'matverse-delegation-v0-4.db'));
  await test('empty DB zero-count projection',async()=>{
    const p=await readDelegationReadiness(connection,()=>now);
    assert.equal(p.leases.total,0);assert.equal(p.actions.total,0);assert.equal(p.actions.dispatchClaimed,0);
  });
  await test('default readiness is fail-closed',async()=>{
    const p=await readDelegationReadiness(connection,()=>now);
    assert.ok(Object.values(p.gates).every(x=>x===false));
  });
  await j.grant(lease('a'));await j.grant(lease('b'));await j.grant(lease('c',1200));
  await j.revokeForOwner('b','owner'); now=1500;
  await test('lease counts separate active expired revoked',async()=>{
    const p=await readDelegationReadiness(connection,()=>now);
    assert.deepEqual(p.leases,{total:3,active:1,expired:1,revoked:1});
  });
  const a1=action('a1','a'),a2=action('a2','a'),a3=action('a3','a');
  await j.reserve(a1,'owner',fingerprint(a1));await j.claimForDispatch('a1','owner','agent',fingerprint(a1));
  await j.reserve(a2,'owner',fingerprint(a2));await j.reconcile('a2',fingerprint(a2),'EXECUTED');
  await j.reserve(a3,'owner',fingerprint(a3));await j.reconcile('a3',fingerprint(a3),'FAILED');
  await test('action aggregates count dispatch claims and unknowns',async()=>{
    const p=await readDelegationReadiness(connection,()=>now);
    assert.deepEqual(p.actions,{total:3,unknown:1,executed:1,failed:1,dispatchClaimed:1});
  });
  await test('projection never exposes principals agents or raw payloads',async()=>{
    const p=JSON.stringify(await readDelegationReadiness(connection,()=>now));
    assert.ok(!p.includes('CONFIDENTIAL_SIMULATED_PAYLOAD'));
    assert.ok(!p.includes('owner')&&!p.includes('agent')&&!p.includes('leaseId'));
  });
  await test('schema includes time and version',async()=>{
    const p=await readDelegationReadiness(connection,()=>now);
    assert.equal(p.schema,'matverse.delegation.readiness.v1');assert.equal(p.inspectedAtMs,now);
  });
  await test('invalid clock rejected',async()=>{
    await assert.rejects(readDelegationReadiness(connection,()=>NaN),/INVALID_TIMESTAMP/);
  });
  await test('malformed SQL aggregate rejected',async()=>{
    const bad={async execute(){},async transaction(fn){
      return fn({async get(){return {total:-1,active:0,expired:0,revoked:0}},async run(){throw Error('unexpected write')}});
    }};
    await assert.rejects(readDelegationReadiness(bad,()=>now),/INVALID_PROJECTION_COUNT/);
  });
  await test('inspection executes SELECT statements only',async()=>{
    let selects=0; const wrapped={...connection,async transaction(fn){return connection.transaction(async tx=>fn({
      async get(sql,...args){assert.ok(/^SELECT\s/i.test(sql),'unexpected nonselect inspection query');selects++;return tx.get(sql,...args)},
      async run(){throw Error('unexpected inspection write')}
    }))}};
    await readDelegationReadiness(wrapped,()=>now);assert.equal(selects,2);
  });
  console.log(count+'/'+count+' PASS');
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}
}
main().catch(err=>{console.error('FAIL',err);process.exitCode=1});
