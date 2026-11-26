import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { fixture,config,write } from './helpers.mjs';
import { lint,applyBaseline } from '../src/lint.mjs';
import { finding } from '../src/report.mjs';
import { classify } from '../src/policy.mjs';

test('private memory is legal and missing tests stay explicit',()=>{
  const root=fixture({'MEMORY.md':'internal'}),r=lint(root,config(root));
  assert.equal(r.exitCode,0);assert.equal(r.workspaces[0].tests,'not-configured');
});
test('layout is framework-specific, nested workspace owns its tests',()=>{
  const root=fixture({'src/a.test.ts':'','pkg/service_test.go':''});
  const c=config(root,{workspaces:[{id:'root',root:'.',tests:{include:['src/**/*.test.ts']}},{id:'pkg',root:'pkg',tests:{include:['**/*_test.go']}}]});
  assert.equal(lint(root,c).exitCode,0);
  write(root,'outside.test.ts','');assert.equal(lint(root,c).findings[0].ruleId,'tests.layout');
});
test('ordinary baseline warns, new finding blocks, public rules never waived',()=>{
  const root=fixture({'docs/verification/a.md':'[test](missing.test.ts)'}),c=config(root);
  const first=lint(root,c);c.baseline=first.findings.map(f=>f.fingerprint);
  assert.equal(lint(root,c).exitCode,0);
  write(root,'docs/verification/b.md','[test](different.test.ts)');assert.equal(lint(root,c).exitCode,1);
  const protectedFinding=finding('publication.internal','MEMORY.md','no',{protectedRule:true});
  assert.equal(applyBaseline([protectedFinding],[protectedFinding.fingerprint])[0].severity,'error');
});
test('test code in artifact directory is checked instead of hidden by traversal ignores',()=>{
  const root=fixture({'artifacts/misplaced.test.ts':''});
  assert.ok(lint(root,config(root)).findings.some(f=>f.ruleId==='tests.artifacts'));
});

test('state check rejects test data hidden in scratch or the Hook directory even when tests are excluded', () => {
  const root = fixture({
    '.harness/tmp/review.json': {},
    '.harness/tmp/specs/login.json': {},
    '.harness/tmp/login.fixture.json': {},
    '.harness/tmp/login.test.json': {},
    '.harness/tmp/custom.run-check.json': {},
    '.harness/hooks/smoke.test.mjs': '',
    '.harness/hooks/draft.ps1': '',
    'tests/fixtures/login.json': {}
  });
  const settings = config(root, { tests: { detect: ['**/*.run-check.json'], exclude: ['.harness/**'] } });
  assert.deepEqual(lint(root, settings).findings.filter(f => f.ruleId === 'storage.state').map(f => f.path).sort(), [
    '.harness/hooks/draft.ps1', '.harness/hooks/smoke.test.mjs', '.harness/tmp/custom.run-check.json',
    '.harness/tmp/login.fixture.json', '.harness/tmp/login.test.json', '.harness/tmp/specs/login.json'
  ]);
});

test('document layout reports review design files and keeps maintained content and exact exemptions', () => {
  const root = fixture({
    'docs/checkout.fig': '',
    'docs/design/checkout.html': '',
    'docs/首页设计稿.png': '',
    'docs/design-draft.md': '',
    'docs/design/checkout-spec.md': '',
    'docs/public/public/logo.svg': '',
    'docs/public/public/screenshots/guide.png': '',
    'docs/public/public/screenshots/next.png': '',
    'docs/public/.vitepress/dist/assets/demo-screenshot.png': '',
    'packages/web/docs/mockups/wireframe.svg': '',
    'packages/web/docs/assets/guide-screenshot.png': '',
    'artifacts/archive/design/checkout.fig': '',
  });
  const options = {
    documents: { artifactAllowlist: ['docs/public/public/screenshots/guide.png'] },
    workspaces: [
      { id: 'root', root: '.' },
      { id: 'web', root: 'packages/web', documents: { artifactAllowlist: ['docs/assets/guide-screenshot.png'] } },
    ],
    tests: { exclude: ['**/docs/**'] },
  };
  const result = lint(root, config(root, options));
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.findings.filter(f => f.ruleId === 'documents.artifacts').map(f => [f.path, f.workspace]).sort(), [
    ['docs/checkout.fig', 'root'],
    ['docs/design-draft.md', 'root'],
    ['docs/design/checkout.html', 'root'],
    ['docs/public/public/screenshots/next.png', 'root'],
    ['docs/首页设计稿.png', 'root'],
    ['packages/web/docs/mockups/wireframe.svg', 'web'],
  ]);
  assert.equal(lint(root, config(root, { ...options, rules: { 'documents.artifacts': 'warning' } })).exitCode, 0);
  assert.throws(() => config(root, { documents: { artifactAllowlist: ['docs/**'] } }), /Unsafe relative path/);
});

test('document placement applies overlapping public and workspace rules independently of publication policy', () => {
  const root = fixture({
    'README.md': '',
    'docs/public/index.md': '',
    'docs/public/guides/getting-started.md': '',
    'docs/public/guides/ADR-002.md': '',
    'docs/public/loose.mdx': '',
    'docs/public/.vitepress/cache/generated.md': '',
    'docs/public/public/logo.svg': '',
    'docs/decision/ADR-001.md': '',
    'packages/web/docs/public/reference/api.md': '',
    'packages/web/docs/public/guide.md': '',
  });
  const options = {
    documents: { layout: [
      { id: 'public-pages', match: ['docs/public/**/*.md', 'docs/public/**/*.mdx'],
        allow: ['docs/public/index.md', 'docs/public/guides/**'], exclude: ['docs/public/.vitepress/**'] },
      { id: 'decision-records', match: ['docs/**/ADR-*.md'], allow: ['docs/decision/**'] },
    ] },
    workspaces: [{ id: 'web', root: 'packages/web', documents: {
      layout: [{ id: 'web-pages', match: ['docs/public/**/*.md'], allow: ['docs/public/reference/**'] }],
    } }],
  };
  const settings = config(root, options);
  const findings = lint(root, settings).findings;
  assert.deepEqual(findings.map(f => [f.path, f.workspace, f.detail.id]), [
    ['docs/public/loose.mdx', 'root', 'public-pages'],
    ['docs/public/guides/ADR-002.md', 'root', 'decision-records'],
    ['packages/web/docs/public/guide.md', 'web', 'web-pages'],
  ]);
  assert.match(findings[0].message, /docs\/public\/guides/);
  assert.equal(lint(root, config(root, { ...options, rules: { 'documents.layout': 'warning' } })).exitCode, 0);
  assert.equal(lint(root, config(root, { ...options, rules: { 'documents.layout': 'off' } })).findings.length, 0);
  assert.equal(classify(settings, 'docs/public/loose.mdx').audience, 'public');
  assert.equal(classify(settings, 'docs/decision/ADR-001.md').audience, 'internal');

  const rule = options.documents.layout[0];
  assert.throws(() => config(root, { documents: { layout: [{ ...rule, allow: [] }] } }), /allow must contain/);
  assert.throws(() => config(root, { documents: { layout: [{ ...rule, match: ['../docs/**'] }] } }), /Unsafe relative path/);
  assert.throws(() => config(root, { documents: { layout: [rule, rule] } }), /Duplicate document layout rule/);
});
