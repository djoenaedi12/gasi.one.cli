import path from 'node:path';
import { listDirEntries, pathExists, readTextFile, removeEmptyDir, removeFile, writeTextFile } from '../../core/fs.js';
import { readManifest, writeManifest } from './manifest.js';
import { resourceKey } from '../../targets/resource/api/migration.js';

export async function cleanResources(document, options) {
  const outputDir = path.resolve(options.outputDir);
  const manifest = await readManifest(outputDir);
  const result = {
    deletedFiles: 0,
    deletedMigrationFiles: 0,
    updatedI18nFiles: 0,
    deletedI18nFiles: 0,
    removedResources: 0,
    skippedResources: 0
  };

  for (const resource of document.resources) {
    const key = resourceKey(resource);
    const entry = manifest.resources?.[key];
    if (!entry) {
      result.skippedResources += 1;
      continue;
    }

    for (const file of entry.files ?? []) {
      if (!shouldDeleteFile(file)) continue;
      if (await removeFile(path.join(outputDir, file.path))) {
        if (file.kind === 'migration') {
          result.deletedMigrationFiles += 1;
        } else {
          result.deletedFiles += 1;
        }
        await removeEmptyParentDirs(outputDir, path.dirname(file.path));
      }
    }

    for (const i18nEntry of entry.i18n ?? []) {
      const action = await removeI18nKeys(outputDir, i18nEntry);
      if (action === 'updated') result.updatedI18nFiles += 1;
      if (action === 'deleted') result.deletedI18nFiles += 1;
    }

    delete manifest.resources[key];
    result.removedResources += 1;
  }

  await writeManifest(outputDir, manifest);
  await removeEmptyParentDirs(outputDir, '.gasi-one');

  return result;
}

function shouldDeleteFile(file) {
  return file.cleanup === true || file.kind === 'migration';
}

async function removeI18nKeys(outputDir, i18nEntry) {
  const absolutePath = path.join(outputDir, i18nEntry.path);
  if (!(await pathExists(absolutePath))) return 'missing';

  const keys = new Set(i18nEntry.keys ?? []);
  const existingContent = await readTextFile(absolutePath);
  const remainingLines = existingContent
    .split(/\r?\n/)
    .filter((line) => !keys.has(propertyKey(line)));

  if (hasProperties(remainingLines)) {
    await writeTextFile(absolutePath, normalizeProperties(remainingLines));
    return 'updated';
  }

  await removeFile(absolutePath);
  await removeEmptyParentDirs(outputDir, path.dirname(i18nEntry.path));
  return 'deleted';
}

async function removeEmptyParentDirs(outputDir, relativeDir) {
  let current = relativeDir;
  while (current && current !== '.' && current !== path.dirname(current)) {
    const absolutePath = path.join(outputDir, current);
    const entries = await listDirEntries(absolutePath);
    if (entries.length > 0) break;
    const removed = await removeEmptyDir(absolutePath);
    if (!removed) break;
    current = path.dirname(current);
  }
}

function hasProperties(lines) {
  return lines.some((line) => propertyKey(line));
}

function normalizeProperties(lines) {
  const trimmedTrailing = [...lines];
  while (trimmedTrailing.length > 0 && trimmedTrailing.at(-1).trim() === '') {
    trimmedTrailing.pop();
  }

  return `${trimmedTrailing.join('\n')}\n`;
}

function propertyKey(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) return null;
  const match = trimmed.match(/^([^:=\s]+)\s*[:=\s]/);
  return match?.[1] ?? null;
}
