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
  const apiResourcePlan = targets.includes('api')
    ? buildApiResourceSet(document.resources, schemaState)
    : { resources: document.resources, embedChildrenByParent: new Map() };

  for (const [index, resource] of apiResourcePlan.resources.entries()) {
    if (targets.includes('api')) {
      const createMigration = await shouldCreateMigration(outputDir, resource);
      plannedFiles.push(...createResourceApiFiles(resource, {
        migrationTimestamp: migrationTimestamp(migrationBaseDate, index),
        includeCreateMigration: createMigration,
        embedChildren: apiResourcePlan.embedChildrenByParent.get(resourceKey(resource)) ?? []
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
    plannedFiles.push(...createResourceApiI18nFiles(apiResourcePlan.resources, { localesByPlugin: i18nLocalesByPlugin }));
  }

  plannedFiles.push(await createManifestFile(apiResourcePlan.resources, outputDir, targets, plannedFiles));

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

function buildApiResourceSet(resources, schemaState) {
  const seenByKey = new Map();
  const seenByName = new Map();
  const manifestResources = new Map(Object.entries(schemaState?.resources ?? {}));
  const manifestByName = new Map();
  const extraParents = new Map();
  const embedChildrenByParent = new Map();

  for (const [key, resource] of manifestResources.entries()) {
    if (!manifestByName.has(resource.name)) manifestByName.set(resource.name, []);
    manifestByName.get(resource.name).push({ key, resource });
  }

  for (const resource of resources) {
    if (resource.mode === 'embed') {
      const parent = resolveEmbedParent(resource, seenByKey, seenByName, manifestResources, manifestByName);
      if (!parent) {
        throw new Error(`Embedded resource ${resource.name} requires generated parent ${resource.parent.resource} first.`);
      }

      if (!embedChildrenByParent.has(parent.key)) embedChildrenByParent.set(parent.key, []);
      embedChildrenByParent.get(parent.key).push(resource);
      if (!resources.some((candidate) => resourceKey(candidate) === parent.key)) {
        extraParents.set(parent.key, parent.resource);
      }
    }

    const key = resourceKey(resource);
    seenByKey.set(key, resource);
    if (!seenByName.has(resource.name)) seenByName.set(resource.name, []);
    seenByName.get(resource.name).push({ key, resource });
  }

  return {
    resources: [...extraParents.values(), ...resources],
    embedChildrenByParent
  };
}

function resolveEmbedParent(resource, seenByKey, seenByName, manifestResources, manifestByName) {
  if (!resource.parent?.resource) return null;
  if (resource.parent.packageName) {
    const key = `${resource.parent.packageName}.${resource.parent.resource}`;
    const parent = seenByKey.get(key) ?? manifestResources.get(key);
    return parent ? { key, resource: parent } : null;
  }

  const seen = seenByName.get(resource.parent.resource) ?? [];
  if (seen.length === 1) return seen[0];
  if (seen.length > 1) {
    throw new Error(`Embedded resource ${resource.name} parent.package is required because parent ${resource.parent.resource} is ambiguous.`);
  }

  const manifests = manifestByName.get(resource.parent.resource) ?? [];
  if (manifests.length === 1) return manifests[0];
  if (manifests.length > 1) {
    throw new Error(`Embedded resource ${resource.name} parent.package is required because parent ${resource.parent.resource} is ambiguous.`);
  }
  return null;
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
