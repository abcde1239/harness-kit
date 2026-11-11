import {discoverJavascript} from './javascript.mjs';
import {discoverGo} from './go.mjs';
import {builtinRecipes, projectRecipes, recipeAdapter} from './recipes.mjs';
import {defaults, validateConfig} from '../config.mjs';

export const builtinAdapters = Object.freeze([
  {id: 'javascript', discover: discoverJavascript},
  {id: 'go', discover: discoverGo},
  ...builtinRecipes.map(recipeAdapter),
]);

export function discoverAdapters(root, files, {adapters = builtinAdapters} = {}) {
  if (!Array.isArray(adapters)) throw new Error('adapters must be an array');
  const registry = new Map();
  for (const adapter of adapters) {
    if (!adapter || typeof adapter.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(adapter.id) || typeof adapter.discover !== 'function') throw new Error('Adapter requires an id and discover(root, files) function');
    if (registry.has(adapter.id)) throw new Error(`Duplicate adapter id: ${adapter.id}`);
    registry.set(adapter.id,adapter);
  }
  // Project-owned declarations may replace a built-in recipe by ID. No project
  // modules, build files or framework configuration are imported or evaluated.
  for (const adapter of projectRecipes(root,files)) registry.set(adapter.id,adapter);
  return [...registry.values()].map(adapter => {
    const result = adapter.discover(root,Object.freeze([...files]));
    if (!result || ['facts','questions','workspaces','tasks'].some(key => !Array.isArray(result[key]))) throw new Error(`Invalid discovery result from adapter: ${adapter.id}`);
    // An unmatched adapter has no configuration to validate. Avoid repeatedly
    // resolving and stat-ing the root once per unrelated technology stack.
    if (!result.workspaces.length && !result.tasks.length) return {...structuredClone(result),adapter:adapter.id};
    const checked = validateConfig({...defaults(), workspaces: result.workspaces.length ? result.workspaces : defaults().workspaces, tasks: result.tasks},root);
    return {...structuredClone(result), adapter: adapter.id, workspaces: result.workspaces.length ? checked.workspaces : [], tasks: checked.tasks};
  });
}
