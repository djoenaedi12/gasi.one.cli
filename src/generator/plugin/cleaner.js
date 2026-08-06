import path from 'node:path';
import { removeEmptyDir, removeFile } from '../../core/fs.js';

export async function cleanPluginPlan(plan) {
  let deleted = 0;
  let skipped = 0;

  for (const file of [...plan.files].reverse()) {
    if (await removeFile(file.absolutePath)) {
      deleted += 1;
      await removeEmptyParentDirs(plan.outputDir, path.dirname(file.path));
    } else {
      skipped += 1;
    }
  }

  return { deleted, skipped };
}

async function removeEmptyParentDirs(outputDir, relativeDir) {
  let current = relativeDir;
  while (current && current !== '.' && current !== path.dirname(current)) {
    const removed = await removeEmptyDir(path.join(outputDir, current));
    if (!removed) break;
    current = path.dirname(current);
  }
}
