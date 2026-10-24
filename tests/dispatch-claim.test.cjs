'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const {DurableDelegationJournal}=require('../.delegation-build/src/delegation/durable-journal.js');
const {GuardedDelegationJournal}=require('../.delegation-build/src/delegation/guarded-journal.js');
const {canonicalSnapshot}=require('../.delegation-build/src/delegation/canonical.js');
const hash=s=>createHash('sha256').update(s).digest('hex');
const action=(id,leaseId)=>({actionId:id,leaseId,agentId:'agent',capability:'local.note.append',scope:'notes',payload:{text:id}});
const finger=a=>hash(JSON.stringify([a.actionId,a.leaseId,a.agentId,a.capability,a.scope,canonicalSnapshot(a.payload).json]));
const lease=id=>({leaseId:id,principalId:'owner',agentId:'agent',capability:'local.note.append',scope:'notes',issuedAtMs:1000,expiresAtMs:4000,maxUses:10,uses:0});
const sqlPort=db=>({async execute(sql){db.exec(sql)},async transaction(fn){db.exec('BEGIN IMMEDIATE');try{const x=await fn({async get(sql,...p){return db.prepare(sql).get(...p)??null},async run(sql,...p){const r=db.prepare(sql).run(...p);return {changes:r.changes}}});db.exec('COMMIT');return x}catch(e){db.exec('ROLLBACK');throw e}}});
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mv-claims-')),file=path.join(dir,'db.sqlite');
 let db=new DatabaseSync(file), secondDb=null, now=1000,passes=0;
 const check=async(name,fn)=>{await fn();passes++;console.log('PASS',name)};
 try{
 let journal=new DurableDelegationJournal(sqlPort(db),()=>now); await journal.initialize();
 const owner='owner-secret',agent='agent-secret';
 const ids={async authenticateOwner(p){return p===owner?{principalId:'owner'}:null},async authenticateAgent(p){return p===agent?{principalId:'owner',agentId:'agent'}:null}};
 let omegaAllows=true;
 const gate={async allow(){return omegaAllows}};
 const consent={async approveLease(){return true},async approveRevocation(){return true}};
 const createFacade=()=>new GuardedDelegationJournal(journal,ids,consent,gate,{async sha256(s){return hash(s)}},undefined,()=>now);
 let guarded=createFacade();
 const grant=id=>journal.grant(lease(id));
 const reserve=a=>guarded.reserve(a,agent),claim=a=>guarded.claimForDispatch(a,agent);
 await check('cannot dispatch before reservation',async()=>{assert.equal((await claim(action('unreserved','L'))).reason,'ACTION_NOT_RESERVED')});
 await check('grant and reserve without execution',async()=>{await grant('L');const a=action('x','L');assert.equal((await reserve(a)).verdict,'RESERVED');assert.equal(await journal.inspect('x'),'UNKNOWN')});
 await check('wrong agent proof refuses claim',async()=>{await assert.rejects(guarded.claimForDispatch(action('x','L'),'wrong'),/AGENT_AUTH_FAILED/)});
 await check('Omega denial at dispatch',async()=>{omegaAllows=false;await assert.rejects(claim(action('x','L')),/OMEGA_DENIED/);omegaAllows=true});
 await check('first claim succeeds',async()=>{assert.equal((await claim(action('x','L'))).verdict,'CLAIMED')});
 await check('second claim blocks duplicate effect',async()=>{assert.equal((await claim(action('x','L'))).reason,'DISPATCH_ALREADY_CLAIMED')});
 await check('principal cannot impersonate',async()=>{assert.equal((await journal.claimForDispatch('x','other','agent',finger(action('x','L')))).reason,'IDENTITY_MISMATCH')});
 await check('altered digest rejected',async()=>{await assert.rejects(journal.claimForDispatch('x','owner','agent',hash('altered')),/ACTION_ID_CONFLICT/)});
 await check('claim persists across restart',async()=>{db.close();db=new DatabaseSync(file);journal=new DurableDelegationJournal(sqlPort(db),()=>now);await journal.initialize();guarded=createFacade();assert.equal((await claim(action('x','L'))).reason,'DISPATCH_ALREADY_CLAIMED')});
 await check('revoke before dispatch blocks effect',async()=>{const a=action('not-sent','L');assert.equal((await reserve(a)).verdict,'RESERVED');await journal.revokeForOwner('L','owner');assert.equal((await claim(a)).reason,'LEASE_REVOKED')});
 await check('revoke does not reset dispatched ID',async()=>{assert.equal((await claim(action('x','L'))).reason,'DISPATCH_ALREADY_CLAIMED')});
 await check('expiry at claim is checked',async()=>{await grant('E');const a=action('late','E');await reserve(a);now=4000;assert.equal((await claim(a)).reason,'LEASE_EXPIRED');now=1000});
 await check('reserved UNKNOWN retry stays HOLD',async()=>{assert.equal((await reserve(action('x','L'))).verdict,'HOLD')});
 await check('two SQLite connections claim once',async()=>{
  await grant('C');const a=action('concurrent','C');await reserve(a);
  secondDb=new DatabaseSync(file);secondDb.exec('PRAGMA busy_timeout=20');const other=new DurableDelegationJournal(sqlPort(secondDb),()=>now);await other.initialize();
  const res=await Promise.allSettled([journal.claimForDispatch(a.actionId,'owner','agent',finger(a)),other.claimForDispatch(a.actionId,'owner','agent',finger(a))]);
  assert.equal(res.filter(x=>x.status==='fulfilled'&&x.value.verdict==='CLAIMED').length,1);
 });
 await check('schema contains dispatch_started_ms',async()=>{assert.equal(db.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('delegation_actions') WHERE name='dispatch_started_ms'").get().n,1)});
 await check('verified outcome reconciles UNKNOWN',async()=>{assert.equal(await journal.inspect('x'),'UNKNOWN');await journal.reconcile('x',finger(action('x','L')),'EXECUTED');assert.equal(await journal.inspect('x'),'EXECUTED')});
 await check('reconciled result cannot dispatch again',async()=>{assert.equal((await claim(action('x','L'))).reason,'OUTCOME_ALREADY_KNOWN')});
 await check('v0.3 migration conservatively holds legacy UNKNOWN',async()=>{
   const oldFile=path.join(dir,'old.sqlite'),oldDb=new DatabaseSync(oldFile);
   try {
     oldDb.exec(`CREATE TABLE delegation_leases (
       lease_id TEXT PRIMARY KEY, principal_id TEXT NOT NULL, agent_id TEXT NOT NULL,
       capability TEXT NOT NULL, scope TEXT NOT NULL, expires_ms INTEGER NOT NULL,
       issued_ms INTEGER NOT NULL, max_uses INTEGER NOT NULL, uses INTEGER NOT NULL DEFAULT 0,
       revoked_ms INTEGER);
       CREATE TABLE delegation_actions (
       action_id TEXT PRIMARY KEY, lease_id TEXT NOT NULL REFERENCES delegation_leases(lease_id),
       principal_id TEXT NOT NULL,agent_id TEXT NOT NULL,fingerprint TEXT NOT NULL,
       status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK(status IN ('UNKNOWN','EXECUTED','FAILED')),
       reserved_ms INTEGER NOT NULL,completed_ms INTEGER);`);
     oldDb.prepare('INSERT INTO delegation_leases VALUES (?,?,?,?,?,?,?,?,?,?)')
       .run('legacy','owner','agent','local.note.append','notes',4000,1000,10,1,null);
     const a=action('old-unknown','legacy');
     oldDb.prepare("INSERT INTO delegation_actions VALUES (?,?,?,?,?,'UNKNOWN',?,NULL)")
       .run(a.actionId,'legacy','owner','agent',finger(a),1000);
     const migrated=new DurableDelegationJournal(sqlPort(oldDb),()=>now);
     await migrated.initialize();
     assert.equal(await migrated.inspect('old-unknown'),'UNKNOWN');
     assert.equal((await migrated.claimForDispatch('old-unknown','owner','agent',finger(a))).reason,'DISPATCH_ALREADY_CLAIMED');
     assert.equal(oldDb.prepare('SELECT dispatch_started_ms FROM delegation_actions WHERE action_id=?').get(a.actionId).dispatch_started_ms,1000);
   }finally{oldDb.close()}
 });
 console.log(passes+'/'+passes+' PASS');
 }finally{db?.close();secondDb?.close();fs.rmSync(dir,{recursive:true,force:true})}
}
main().catch(e=>{console.error('FAIL',e);process.exitCode=1});
