import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const wanted='a'.repeat(40),wrong='b'.repeat(40);
const shell=[
'#!/usr/bin/env bash',
'case "$*" in',
' *"/api/v1/deployments/deployment12345"*)',
'  printf '{"status":"finished","commit":"%s"}\\n' "$MOCK_COOLIFY_COMMIT";;',
' *"/api/v1/deploy"*)',
'  printf '{"deployments":[{"resource_uuid":"resource12345","deployment_uuid":"deployment12345"}]}\\n';;',
' *"/ready"*)',
'  printf '{"ok":true,"status":"ready","database":"reachable"}\\n';;',
' *) echo "Unexpected endpoint" >&2;exit 22;;',
'esac'
].join('\n')+'\n';
function simulate(commit,settings={}){
 const tmp=mkdtempSync(join(tmpdir(),'seotakatak-ci-'));
 try{
  writeFileSync(join(tmp,'curl'),shell,{mode:0o700});
  chmodSync(join(tmp,'curl'),0o700);
  return spawnSync('bash',['scripts/deploy-coolify.sh'],{
   cwd:process.cwd(),encoding:'utf8',timeout:15000,
   env:{...process.env,PATH:tmp+':'+process.env.PATH,
    COOLIFY_API_URL:'https://coolify.example.test',
    COOLIFY_API_TOKEN:'DUMMY_TEST_TOKEN',
    COOLIFY_APP_UUID:'resource12345',
    SEOTAKATAK_HEALTH_URL:'https://seo.example.test',
    EXPECTED_COMMIT_SHA:wanted,
    MOCK_COOLIFY_COMMIT:commit,...settings}
  });
 }finally{rmSync(tmp,{recursive:true,force:true});}
}
test('Coolify deploy verifies exact SHA and database-ready HTTP probe',()=>{
 const result=simulate(wanted);
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/production ready/);
});
test('completed deployment of different SHA fails closed',()=>{
 const result=simulate(wrong);
 assert.notEqual(result.status,0);
 assert.match(result.stdout+result.stderr,/does not match/);
});
test('missing production URL fails before network',()=>{
 const result=simulate(wanted,{COOLIFY_API_URL:''});
 assert.notEqual(result.status,0);
 assert.match(result.stdout+result.stderr,/Missing production setting/);
});
