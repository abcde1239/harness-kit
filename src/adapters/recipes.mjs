import fs from 'node:fs';
import path from 'node:path';
import {defaults, validateConfig} from '../config.mjs';
import {matches, safePath, relativePath, under, hash} from '../fs.mjs';

export const ADAPTERS_FILE = 'harness.adapters.json';
export function workspaceId(directory, directories = [directory]) {
  const simple = dir => dir === '.' ? 'root' : dir.replace(/[^a-zA-Z0-9._-]/g, '-');
  const id = simple(directory);
  return new Set(directories.filter(dir => simple(dir) === id)).size > 1 ? `${id}-${hash(directory).slice(0,8)}` : id;
}
const checkKeys = (v, allowed, label) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${label} must be an object`);
  for (const key of Object.keys(v)) if (!allowed.includes(key)) throw new Error(`Unknown ${label} field: ${key}`);
};
function patterns(value, label, {required = false} = {}) {
  if (!Array.isArray(value) || (required && !value.length) || value.some(p => typeof p !== 'string')) throw new Error(`${label} must be ${required ? 'a nonempty' : 'a'} glob array`);
  value.forEach(p => relativePath(p, {glob: true}));
}
export function validateRecipe(value) {
  checkKeys(value, ['id','markers','exclude','nested','tests','tasks'], 'adapter recipe');
  const recipe = structuredClone(value);
  if (typeof recipe.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(recipe.id)) throw new Error('Invalid adapter recipe id');
  patterns(recipe.markers, 'recipe.markers', {required: true});
  recipe.exclude ??= []; patterns(recipe.exclude, 'recipe.exclude');
  recipe.nested ??= 'all';
  if (!['all','outermost'].includes(recipe.nested)) throw new Error('recipe.nested must be all or outermost');
  recipe.tasks ??= [];
  if (!Array.isArray(recipe.tasks)) throw new Error('recipe.tasks must be an array');
  for (const task of recipe.tasks) checkKeys(task, ['id','argv','cwd','kind','dependsOn','required','enabled','timeoutMs'], 'recipe task');
  // Reuse the task and test-policy contract, including dependency validation,
  // even when no marker in this project matches the recipe.
  validateConfig({...defaults(), tests: recipe.tests ?? {}, tasks: recipe.tasks.map(t => ({...t, workspace: 'root'}))});
  return recipe;
}
export function recipeAdapter(value) {
  const recipe = validateRecipe(value);
  return {id: recipe.id, discover(root, files) {
    const markers = files.filter(f => recipe.markers.some(p => matches(f,p)) && !recipe.exclude.some(p => matches(f,p)));
    const directories = [...new Set(markers.map(f => path.posix.dirname(f)))];
    const selected = directories.filter(dir => recipe.nested !== 'outermost' || !directories.some(other => other !== dir && under(dir,other)));
    const workspaces = selected.map(dir => ({id: workspaceId(dir,selected), root: dir, ...(recipe.tests ? {tests: structuredClone(recipe.tests)} : {})}));
    const tasks = workspaces.flatMap(w => recipe.tasks.map(t => ({...structuredClone(t), id: `${w.id}:${recipe.id}:${t.id}`, workspace: w.id, dependsOn: (t.dependsOn ?? []).map(d => `${w.id}:${recipe.id}:${d}`)})));
    const facts = markers.map(source => ({source, capability: 'stack-project', adapter: recipe.id, workspaceRoot: selected.find(dir => dir === path.posix.dirname(source)) ?? [...selected].sort((a,b)=>b.length-a.length).find(dir => under(source,dir))}));
    return {facts, workspaces, tasks, questions: []};
  }};
}
export function projectRecipes(root, files) {
  if (!files.includes(ADAPTERS_FILE)) return [];
  const text = fs.readFileSync(safePath(root, ADAPTERS_FILE, {allowMissing: false}), 'utf8');
  let declaration;
  try { declaration = JSON.parse(text); } catch { throw new Error(`Invalid JSON: ${ADAPTERS_FILE}`); }
  checkKeys(declaration, ['schemaVersion','recipes'], ADAPTERS_FILE);
  if (declaration.schemaVersion !== 1 || !Array.isArray(declaration.recipes)) throw new Error(`${ADAPTERS_FILE} requires schemaVersion 1 and recipes`);
  const recipes = declaration.recipes.map(recipeAdapter);
  if (new Set(recipes.map(r => r.id)).size !== recipes.length) throw new Error('Duplicate project adapter recipe id');
  return recipes;
}

// These identify project roots, not test runners. Commands and aggregate
// coverage remain explicit when the manifest does not establish them.
export const builtinRecipes = Object.freeze([
  {id:'python', markers:['**/pyproject.toml','**/setup.py','**/setup.cfg','**/pytest.ini','**/tox.ini','**/requirements.txt']},
  {id:'rust', markers:['**/Cargo.toml'], nested:'outermost'},
  {id:'jvm', markers:['**/pom.xml','**/settings.gradle','**/settings.gradle.kts','**/build.gradle','**/build.gradle.kts'], nested:'outermost'},
  {id:'dotnet', markers:['**/*.sln','**/*.slnx','**/*.csproj','**/*.fsproj','**/*.vbproj'], nested:'outermost'},
  {id:'php', markers:['**/composer.json','**/phpunit.xml','**/phpunit.xml.dist']},
  {id:'ruby', markers:['**/Gemfile','**/*.gemspec']},
  {id:'cmake', markers:['**/CMakeLists.txt','**/CMakePresets.json'], nested:'outermost'},
  {id:'dart', markers:['**/pubspec.yaml']},
  {id:'elixir', markers:['**/mix.exs'], nested:'outermost'},
  {id:'swift', markers:['**/Package.swift'], nested:'outermost'},
]);
