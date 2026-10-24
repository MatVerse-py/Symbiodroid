'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {specifiersFromPnpmLock,report}=require('../scripts/audit-pnpm-lock.cjs');
const wrap=entries=>`lockfileVersion: '9.0'
importers:
  .:
    dependencies:
${entries}
packages:
  test:
    resolution: {}`;
test('accepts consistent root importer',()=>{
 const y=wrap("      expo:\n        specifier: ~53.0.9\n        version: 53.0.9\n");
 assert.equal(report({dependencies:{expo:'~53.0.9'}},y).consistent,true);
});
test('rejects absent importer entry',()=>{
 const y=wrap("      expo:\n        specifier: ~53.0.9\n        version: 53.0.9\n");
 assert.deepEqual(report({dependencies:{expo:'~53.0.9', 'expo-sqlite':'^15.2.13'}},y).missing,['expo-sqlite']);
});
test('rejects specifier mismatch even if version resolves',()=>{
 const y=wrap("      expo:\n        specifier: ~53.0.12\n        version: 53.0.12\n");
 assert.equal(report({dependencies:{expo:'~53.0.9'}},y).mismatch.length,1);
});
test('rejects unexpected importer dependencies',()=>{
 const y=wrap("      expo:\n        specifier: ~53.0.9\n        version: 53.0.9\n");
 assert.deepEqual(report({dependencies:{}},y).extra,['expo']);
});
test('rejects duplicate package records',()=>{
 const y=wrap("      expo:\n        specifier: ~53.0.9\n        version: 53.0.9\n      expo:\n        specifier: ~53.0.9\n        version: 53.0.9\n");
 assert.throws(()=>specifiersFromPnpmLock(y),/DUPLICATE_IMPORTER_SPECIFIER/);
});
test('rejects unsupported lockfile version',()=>{
 assert.throws(()=>specifiersFromPnpmLock(wrap('').replace("'9.0'","'6.0'")),/UNSUPPORTED_PNPM_LOCK_VERSION/);
});
