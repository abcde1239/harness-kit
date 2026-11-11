import {test} from 'bun:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,write,config} from './helpers.mjs';
import {inspect} from '../src/discovery.mjs';
import {makePlan,applyPlan} from '../src/planner.mjs';
import {lint} from '../src/lint.mjs';
import {validateConfig,loadConfig} from '../src/config.mjs';
import {recipeAdapter} from '../src/adapters/recipes.mjs';
import {discoverAdapters} from '../src/adapters/registry.mjs';
import {verifyProject,verificationEvidence} from '../src/workflow.mjs';
import {diagnose} from '../src/readiness.mjs';

const declaration = recipes => ({schemaVersion:1,recipes});
const recipe = {id:'elixir',markers:['**/mix.exs'],tests:{detect:['**/*_test.exs'],include:['test/**/*_test.exs']},tasks:[{id:'test',argv:['mix','test']}]};

test('other stack manifests discover native roots without evaluating code or guessing runners',()=>{
 const root=fixture({'api/pyproject.toml':'[project]\nname="api"','api/setup.py':"raise RuntimeError('never evaluate')",'engine/Cargo.toml':'[workspace]','engine/crate/Cargo.toml':'[package]','server/pom.xml':'<project/>','server/module/pom.xml':'<project/>','dotnet/app.sln':'','dotnet/lib/lib.csproj':'','php/composer.json':'{}','ruby/Gemfile':"raise 'never evaluate'",'native/CMakeLists.txt':'message(FATAL_ERROR "never execute")','dart/pubspec.yaml':'name: app','beam/mix.exs':'raise "never execute"','swift/Package.swift':'fatalError()'});
 const scan=inspect(root);
 assert.deepEqual(scan.suggestedConfig.workspaces.map(w=>w.root).sort(),['api','beam','dart','dotnet','engine','native','php','ruby','server','swift']);
 assert.equal(scan.suggestedConfig.tasks.length,0);
 assert.equal(scan.questions.filter(q=>q.type==='test-command').length,10);
 assert.equal(scan.facts.find(f=>f.source==='engine/crate/Cargo.toml').workspaceRoot,'engine');
});

test('a project recipe exposes an arbitrary stack through normal plan and apply',()=>{
 const root=fixture({'harness.adapters.json':declaration([recipe]),'apps/api/mix.exs':'','apps/api/test/auth_test.exs':'','apps/api/src/keep.ex':'original'});
 const plan=makePlan(root,{visibility:'private'});assert.equal(plan.unanswered.length,0);
 const proposed=JSON.parse(plan.files.find(f=>f.path==='harness.config.json').content);
 assert.deepEqual(proposed.tasks[0].argv,['mix','test']);assert.equal(proposed.tasks[0].workspace,'apps-api');
 assert.deepEqual(proposed.workspaces[0].tests.detect,['**/*_test.exs']);
 assert.equal(applyPlan(root,plan).status,'applied');assert.equal(fs.readFileSync(root+'/apps/api/src/keep.ex','utf8'),'original');
 assert.equal(lint(root,validateConfig(proposed,root)).status,'passed');
});

test('recipe dependencies are namespaced per native project directory',()=>{
 const root=fixture({'harness.adapters.json':declaration([{...recipe,tasks:[{id:'prepare',kind:'build',argv:['mix','compile']},{id:'test',argv:['mix','test'],dependsOn:['prepare'],cwd:'test',timeoutMs:12345}]}]),'one/mix.exs':'','two/mix.exs':''});
 const tasks=inspect(root).suggestedConfig.tasks;
 assert.deepEqual(tasks.find(t=>t.id==='one:elixir:test').dependsOn,['one:elixir:prepare']);
 assert.deepEqual(tasks.find(t=>t.id==='two:elixir:test').dependsOn,['two:elixir:prepare']);
 assert.equal(tasks.find(t=>t.id==='one:elixir:test').cwd,'test');assert.equal(tasks.find(t=>t.id==='one:elixir:test').timeoutMs,12345);
});

test('project recipes replace built-in recipes by ID and honor exclusions and nesting',()=>{
 const root=fixture({'harness.adapters.json':declaration([{id:'python',markers:['**/project.custom'],exclude:['vendor/**'],nested:'outermost',tasks:[{id:'test',argv:['custom','test']}]}]),'api/project.custom':'','api/child/project.custom':'','vendor/project.custom':'','ignored/pyproject.toml':''});
 const scan=inspect(root);assert.deepEqual(scan.suggestedConfig.workspaces.map(w=>w.root),['api']);assert.deepEqual(scan.suggestedConfig.tasks[0].argv,['custom','test']);
});

test('programmatic discovery uses the same registry and validates adapter results',()=>{
 const root=fixture({'app.marker':''});
 const adapters=[{id:'embedded',discover:()=>({facts:[{source:'app.marker',capability:'custom'}],questions:[],workspaces:[{id:'app',root:'.'}],tasks:[{id:'app:test',workspace:'app',argv:['custom','test']}]})}];
 assert.equal(inspect(root,{adapters}).suggestedConfig.tasks[0].kind,'test');
 assert.throws(()=>inspect(root,{adapters:[...adapters,...adapters]}),/Duplicate adapter/);
 assert.throws(()=>inspect(root,{adapters:[{id:'bad',discover:()=>Promise.resolve({})}]}),/Invalid discovery result/);
 assert.throws(()=>inspect(root,{adapters:[{id:'escape',discover:()=>({facts:[],questions:[],workspaces:[{id:'bad',root:'../outside'}],tasks:[]})}]}),/Unsafe relative path/);
});

test('co-located stacks retain commands and combine test recognition without narrowing paths',()=>{
 const root=fixture({'go.mod':'module x','mix.exs':'','harness.adapters.json':declaration([recipe]),'test/auth_test.exs':'','main_test.go':''});
 const proposed=makePlan(root,{visibility:'private'});assert.equal(proposed.unanswered.length,0);
 const c=validateConfig(JSON.parse(proposed.files.find(f=>f.path==='harness.config.json').content),root);
 assert.equal(c.workspaces.length,1);assert.equal(c.tasks.length,2);assert.deepEqual(c.workspaces[0].tests.include,['**/*_test.go','test/**/*_test.exs']);
 assert.ok(c.workspaces[0].tests.detect.includes('**/*_test.exs'));assert.ok(c.workspaces[0].tests.detect.includes('**/*_test.go'));assert.equal(lint(root,c).status,'passed');
 write(root,'pyproject.toml','[project]');
 const mixed=makePlan(root,{visibility:'private'});assert.deepEqual(JSON.parse(mixed.files.find(f=>f.path==='harness.config.json').content).workspaces[0].tests.include,[]);
});

test('explicit configuration stays authoritative and drift uses configured workspace IDs',()=>{
 const root=fixture({'harness.adapters.json':declaration([recipe]),'api/mix.exs':''});
 const c=config(root,{workspaces:[{id:'backend',root:'api'}],tasks:[{id:'verify-backend',workspace:'backend',kind:'test',argv:['existing','test']}]});write(root,'harness.config.json',c);
 const scan=inspect(root);assert.equal(scan.suggestedConfig.workspaces[0].id,'backend');assert.deepEqual(scan.suggestedConfig.tasks[0].argv,['existing','test']);assert.equal(scan.drift.tasks.length,0);
 write(root,'harness.config.json',config(root,{workspaces:[{id:'backend',root:'api'}],tasks:[]}));
 const drift=inspect(root).drift.tasks[0];assert.equal(drift.workspace,'backend');assert.equal(drift.id,'backend:elixir:test');
});

test('custom detection separates test identity, allowed layout and excluded files',()=>{
 const root=fixture({'suite/ok.check':'','src/misplaced.check':'','artifacts/generated.check':'','fixtures/ignored.check':'','src/main.py':''});
 const c=validateConfig(config(root,{tests:{detect:['**/*.check'],include:['suite/**'],exclude:['fixtures/**'],artifacts:['artifacts']}}),root);
 const findings=lint(root,c).findings;assert.deepEqual(findings.map(f=>[f.ruleId,f.path]).sort(),[['tests.artifacts','artifacts/generated.check'],['tests.layout','src/misplaced.check']]);
 c.tests.detect=[];assert.equal(lint(root,c).findings.length,0);
 assert.throws(()=>validateConfig({...c,tests:{detect:['../*.check']}},root),/Unsafe relative path/);
});

test('default test recognition covers common non-JS and non-Go conventions',()=>{
 const root=fixture(Object.fromEntries(['test_auth.py','auth_test.py','auth_spec.rb','AuthTest.java','AuthTests.cs','AuthTest.php','tests/integration.rs','auth_test.dart','auth_test.exs','AuthTests.swift','test_auth.cpp'].map(f=>['artifacts/'+f,''])));
 const result=lint(root,validateConfig(config(root),root));assert.equal(result.findings.filter(f=>f.ruleId==='tests.artifacts').length,11);
});

test('recipe validation rejects malformed or unsafe declarations even without matching markers',()=>{
 for(const invalid of [{...recipe,typo:true},{...recipe,markers:['../mix.exs']},{...recipe,tasks:[{id:'bad',argv:[]}]},{...recipe,tasks:[{id:'test',argv:['mix','test'],dependsOn:['absent']}]},{...recipe,tests:{detect:['../*.exs']}},{...recipe,nested:'guess'}])assert.throws(()=>recipeAdapter(invalid));
 const root=fixture({'harness.adapters.json':declaration([recipe,recipe])});assert.throws(()=>inspect(root),/Duplicate project/);
 write(root,'harness.adapters.json','not json');assert.throws(()=>inspect(root),/Invalid JSON/);
 write(root,'harness.adapters.json',{schemaVersion:2,recipes:[]});assert.throws(()=>inspect(root),/schemaVersion/);
});

test('sanitized workspace ID collisions retain independent task ownership',()=>{
 const root=fixture({'harness.adapters.json':declaration([recipe]),'a-b/mix.exs':'','a/b/mix.exs':''});const scan=inspect(root);
 assert.equal(new Set(scan.suggestedConfig.workspaces.map(w=>w.id)).size,2);
 for(const w of scan.suggestedConfig.workspaces)assert.equal(scan.suggestedConfig.tasks.filter(t=>t.workspace===w.id).length,1);
});

test('recipe changes after planning are refused before project configuration is written',()=>{
 const root=fixture({'harness.adapters.json':declaration([recipe]),'mix.exs':''});const plan=makePlan(root,{visibility:'private'});
 write(root,'harness.adapters.json',declaration([{...recipe,tasks:[{id:'test',argv:['other','test']}]}]));
 assert.throws(()=>applyPlan(root,plan),/Adapter declarations changed/);assert.equal(fs.existsSync(root+'/harness.config.json'),false);
});

test('recipe changes invalidate prior verification and remain suggestions after onboarding',async()=>{
 const root=fixture({'harness.adapters.json':declaration([{id:'custom',markers:['project.custom'],tasks:[{id:'test',argv:[process.execPath,'-e','if(2+3!==5)process.exit(1)']}]}]),'project.custom':''});
 applyPlan(root,makePlan(root,{visibility:'private'}));assert.equal((await verifyProject(root,loadConfig(root))).status,'passed');assert.equal(diagnose(root).status,'ready');
 write(root,'harness.adapters.json',declaration([{id:'custom',markers:['project.custom'],tasks:[{id:'test',argv:['changed','test']}]}]));
 assert.equal(verificationEvidence(root,loadConfig(root)).status,'stale');assert.equal(inspect(root).suggestedConfig.tasks[0].argv[0],process.execPath);
});
