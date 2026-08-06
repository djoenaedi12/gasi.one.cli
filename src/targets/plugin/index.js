import { createPluginApiFiles } from './api.js';

export function createPluginFiles(plugin, targets) {
  const files = [];
  const notes = [];

  if (targets.includes('api')) files.push(...createPluginApiFiles(plugin));
  if (targets.includes('web')) notes.push('Plugin web generation is not implemented yet.');

  return { files, notes };
}
