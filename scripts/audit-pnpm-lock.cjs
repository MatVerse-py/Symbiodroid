#!/usr/bin/env node
/**
 * Deterministic manifest-to-pnpm-lock importer audit; no dependency installation.
 * Exits non-zero if any declared dependency is missing or its specifier has drifted.
 * This does not validate registry integrity, Expo compatibility or APK compilation.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

function specifiersFromPnpmLock(text) {
  if (!/^lockfileVersion:\s*['"]?9\.0['"]?/m.test(text)) throw Error('UNSUPPORTED_PNPM_LOCK_VERSION');
  const start = text.indexOf('importers:\n');
  const end = text.indexOf('\npackages:', start);
  if (start < 0 || end <= start) throw Error('LOCKFILE_MISSING_IMPORTER_OR_PACKAGES');
  const region = text.slice(start, end);
  if (!/^\s{2}\.\:\s*$/m.test(region)) throw Error('ROOT_IMPORTER_MISSING');
  const records = new Map();
  const pattern = /^      (?:'([^']+)'|"([^"]+)"|([^:\n]+)):\n        specifier: (.+)$/gm;
  let match;
  while ((match = pattern.exec(region)) !== null) {
    const name = match[1] || match[2] || match[3];
    const spec = match[4].trim().replace(/^['"]|['"]$/g, '');
    if (records.has(name)) throw Error('DUPLICATE_IMPORTER_SPECIFIER:' + name);
    records.set(name, spec);
  }
  return records;
}
function report(manifest, lock) {
  const expected = {...manifest.dependencies, ...manifest.devDependencies};
  const observed = specifiersFromPnpmLock(lock);
  const missing = [];
  const mismatch = [];
  const extra = [];
  for (const [name,spec] of Object.entries(expected)) {
    if (!observed.has(name)) missing.push(name);
    else if (observed.get(name) !== spec) mismatch.push({name, declared:spec, locked:observed.get(name)});
  }
  for (const name of observed.keys()) if (!Object.hasOwn(expected,name)) extra.push(name);
  return {declared:Object.keys(expected).length,locked:observed.size,missing,mismatch,extra,consistent:missing.length===0&&mismatch.length===0&&extra.length===0};
}
function main() {
  const root = path.resolve(__dirname,'..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const lock = fs.readFileSync(path.join(root,'pnpm-lock.yaml'),'utf8');
  const result = report(packageJson,lock);
  console.log(JSON.stringify({
    declared:result.declared,locked:result.locked,
    missingCount:result.missing.length,mismatchCount:result.mismatch.length,extraCount:result.extra.length,
    missing:result.missing.slice(0,20),mismatch:result.mismatch.slice(0,20),extra:result.extra.slice(0,20),
    status:result.consistent?'PASS':'HOLD_LOCKFILE_DRIFT',
  },null,2));
  if (!result.consistent) process.exitCode=1;
}
if (require.main === module) {
  try {main();} catch(err) {console.error('LOCK_AUDIT_FAILED:',err.message);process.exitCode=1;}
}
module.exports = {specifiersFromPnpmLock,report};
