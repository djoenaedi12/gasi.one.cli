import path from 'node:path';
import { listFiles, pathExists, readTextFile } from '../../core/fs.js';
import { renderTemplate } from '../template-renderer.js';
import { mergeProperties } from '../writer.js';
import {
  createResourceApiAlterMigrationFile,
  createResourceApiFiles,
  createResourceApiI18nFiles,
  createResourceWebFiles
} from '../../targets/resource/index.js';
import { resourceKey } from '../../targets/resource/api/migration.js';
import { createManifestFile, readManifestPluginLocales, readManifestSchemaState } from './manifest.js';

export async function buildResourcePlan(document, options) {
  const outputDir = path.resolve(options.outputDir);
  const targets = resolveTargets(options.target);
  const plannedFiles = [];
  const migrationBaseDate = new Date();
  const schemaState = targets.includes('api') ? await readManifestSchemaState(outputDir) : null;
  const i18nLocalesByPlugin = targets.includes('api') ? await readManifestPluginLocales(outputDir) : new Map();

  for (const [index, resource] of document.resources.entries()) {
    if (targets.includes('api')) {
      const createMigration = await shouldCreateMigration(outputDir, resource);
      plannedFiles.push(...createResourceApiFiles(resource, {
        migrationTimestamp: migrationTimestamp(migrationBaseDate, index),
        includeCreateMigration: createMigration
      }));
      const previousSnapshot = schemaState?.resources?.[resourceKey(resource)];
      if (!createMigration && previousSnapshot) {
        plannedFiles.push(...createResourceApiAlterMigrationFile(
          resource,
          previousSnapshot,
          migrationTimestamp(migrationBaseDate, document.resources.length + index)
        ));
      }
    }
    if (targets.includes('web')) plannedFiles.push(...createResourceWebFiles(resource));
  }

  if (targets.includes('api')) {
    plannedFiles.push(...createResourceApiI18nFiles(document.resources, { localesByPlugin: i18nLocalesByPlugin }));
  }

  plannedFiles.push(await createManifestFile(document.resources, outputDir, targets, plannedFiles));

  const files = [];
  for (const file of plannedFiles) {
    const content = await renderTemplate(file.template, file.context);
    const absolutePath = path.join(outputDir, file.path);
    const exists = await pathExists(absolutePath);
    files.push({
      ...file,
      absolutePath,
      content,
      action: await fileAction(file, absolutePath, content, exists)
    });
  }

  return { outputDir, files };
}

async function fileAction(file, absolutePath, content, exists) {
  if (!exists) return 'create';
  if (file.writeStrategy === 'merge-properties') {
    return (await mergeProperties(absolutePath, content)) === null ? 'skip' : 'update';
  }

  return (await readTextFile(absolutePath)) === content ? 'skip' : 'update';
}

async function shouldCreateMigration(outputDir, resource) {
  const pluginName = resource.pluginName ?? pluginNameFromPackage(resource.packageName);
  const migrationDir = path.join(outputDir, 'src/main/resources/db/migration', pluginName);
  const files = await listFiles(migrationDir);
  return !files.some((file) => new RegExp(`^V\\d+__create_${escapeRegExp(resource.tableName)}\\.sql$`).test(file));
}

function pluginNameFromPackage(packageName) {
  const parts = packageName.split('.');
  const oneIndex = parts.findIndex((part, index) => part === 'one' && parts[index - 1] === 'gasi');
  return parts[oneIndex + 1] ?? parts.at(-2) ?? 'app';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function migrationTimestamp(baseDate, offsetSeconds) {
  const date = new Date(baseDate.getTime() + offsetSeconds * 1000);
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');
}

function resolveTargets(target) {
  if (target === 'api') return ['api'];
  return ['web'];
}
