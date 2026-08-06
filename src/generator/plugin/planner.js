import path from 'node:path';
import { pathExists, readTextFile } from '../../core/fs.js';
import { renderTemplate } from '../template-renderer.js';
import { createPluginFiles } from '../../targets/plugin/index.js';

export async function buildPluginPlan(document, options) {
  const outputDir = path.resolve(options.outputDir);
  const targets = resolveTargets(options.target);
  const { files: plannedFiles, notes } = createPluginFiles(document, targets);

  const files = [];
  for (const file of plannedFiles) {
    const content = await renderTemplate(file.template, file.context);
    const absolutePath = path.join(outputDir, file.path);
    const exists = await pathExists(absolutePath);
    files.push({
      ...file,
      absolutePath,
      content,
      action: await fileAction(absolutePath, content, exists)
    });
  }

  return { outputDir, files, notes };
}

async function fileAction(absolutePath, content, exists) {
  if (!exists) return 'create';
  return (await readTextFile(absolutePath)) === content ? 'skip' : 'update';
}

function resolveTargets(target) {
  if (target === 'api') return ['api'];
  return ['web'];
}
