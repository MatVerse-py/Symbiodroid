'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {expoSqlitePort}=require('../.delegation-build/src/delegation/expo-sqlite-port.js');
const {DurableDelegationJournal}=require('../.delegation-build/src/delegation/durable-journal.js');
const {readDelegationReadiness}=require('../.delegation-build/src/delegation/readiness.js');
const {canonicalSnapshot}=require('../.delegation-build/src/delegation/canonical.js');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const makeLease=id=>({leaseId:id,principalId:'owner',agentId:'agent',scope:'notes',
  capability:'local.note.append',issuedAtMs:1000,expiresAtMs:4000,maxUses:2,uses:0});
const makeAction=(id,l)=>({actionId:id,leaseId:l,agentId:'agent',scope:'notes',
  capability:'local.note.append',payload:{text:'test'}});
const digest=a=>sha(JSON.stringify([a.actionId,a.leaseId,a.agentId,a.capability,a.scope,
  canonicalSnapshot(a.payload).json]));
function expoMock(db,probe){
 return {
  async execAsync(sql){probe.exec++;db.exec(sql)},
  async withExclusiveTransactionAsync(task){
    probe.tx++;db.exec('BEGIN IMMEDIATE');
    try {
      const result=await task({
        async runAsync(sql,...args){probe.run++;const r=db.prepare(sql).run(...args);return {changes:r.changes}},
        async getFirstAsync(sql,...args){probe.read++;return db.prepare(sql).get(...args)??null}
      });
      db.exec('COMMIT');return result;
    }catch(e){db.exec('ROLLBACK');throw e}
  }
 };
}
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mv-expo-adapter-')),db=new DatabaseSync(path.join(dir,'test.db'));
 const probe={exec:0,tx:0,read:0,run:0};const port=expoSqlitePort(expoMock(db,probe));
 const journal=new DurableDelegationJournal(port,()=>1000);let count=0;
 const check=async(name,fn)=>{await fn();count++;console.log('PASS',name)};
 try{
  await check('structural Expo async adapter bootstraps SQLite schema',async()=>{
    await journal.initialize();assert.ok(probe.exec>0);assert.ok(probe.tx>0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='delegation_leases'").get().n,1);
  });
  await check('read-only readiness projection uses two getFirstAsync calls',async()=>{
    const b=probe.read,r=probe.run;const snap=await readDelegationReadiness(port,()=>1000);
    assert.equal(snap.leases.total,0);assert.equal(probe.read-b,2);assert.equal(probe.run,r);
  });
  await check('Expo adapter commits a lease across transaction',async()=>{
    await journal.grant(makeLease('L'));assert.equal((await journal.getLeaseForOwner('L','owner')).uses,0);
  });
  await check('Expo adapter reserves + dispatch-claims once',async()=>{
    const a=makeAction('A','L');
    assert.equal((await journal.reserve(a,'owner',digest(a))).verdict,'RESERVED');
    assert.equal((await journal.claimForDispatch('A','owner','agent',digest(a))).verdict,'CLAIMED');
    assert.equal((await journal.claimForDispatch('A','owner','agent',digest(a))).reason,'DISPATCH_ALREADY_CLAIMED');
  });
  await check('Expo adapter rollback prevents partial writes',async()=>{
    let failed=false;
    try{await port.transaction(async tx=>{await tx.run("UPDATE delegation_leases SET uses=uses+1 WHERE lease_id='L'");
      throw Error('test-rollback');});}catch(e){failed=String(e).includes('test-rollback')}
    assert.equal(failed,true);
    assert.equal((await journal.getLeaseForOwner('L','owner')).uses,1);
  });
  await check('Expo adapter persists revocations',async()=>{
    await journal.revokeForOwner('L','owner');
    const a=makeAction('NEXT','L');
    assert.equal((await journal.reserve(a,'owner',digest(a))).reason,'LEASE_REVOKED');
  });
  await check('injected bad native read fails closed',async()=>{
    const broken=expoSqlitePort({async execAsync(){throw Error('native unavailable')},
      async withExclusiveTransactionAsync(){throw Error('native unavailable')}});
    await assert.rejects(readDelegationReadiness(broken,()=>1000),/native unavailable/);
  });
  await check('source UI requires explicit action to initialize SQLite',async()=>{
    const screen=fs.readFileSync(path.join(__dirname,'../app/delegation-audit.tsx'),'utf8');
    assert.doesNotMatch(screen,/\buseEffect\b/);
    assert.match(screen,/onPress=\{\(\) => void refresh\(\)\}/);
    assert.match(screen,/cria banco SQLite local não criptografado/);
    assert.match(screen,/NÃO INICIADO/);
    assert.match(screen,/void refresh\(\)/);
    assert.match(screen,/openDatabaseAsync\(DELEGATION_DATABASE_NAME\)/);
  });
  console.log(count+'/'+count+' PASS');
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}
}
main().catch(e=>{console.error('FAIL',e);process.exitCode=1});
