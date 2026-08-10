import path from 'node:path';
import { featurePathFromPackage, packageToPath } from '../../core/naming.js';
import { listFiles, pathExists, readJson, writeTextFile } from '../../core/fs.js';
import { pluginName, resourceKey, snapshotResource } from '../../targets/resource/api/migration.js';

const manifestPath = '.gasi-one/manifest.json';

export function manifestFilePath(outputDir) {
  return path.join(outputDir, manifestPath);
}

export async function readManifestSchemaState(outputDir) {
  const manifest = await readManifest(outputDir);
  return {
    resources: Object.fromEntries(
      Object.entries(manifest.resources ?? {})
        .filter(([, resource]) => resource?.schema)
        .map(([key, resource]) => [key, resource.schema])
    )
  };
}

export async function readManifestPluginLocales(outputDir) {
  return manifestPluginLocales(await readManifest(outputDir));
}

export async function createManifestFile(resources, outputDir, targets, plannedFiles = []) {
  const existingManifest = await readManifest(outputDir);
  const i18nLocalesByPlugin = pluginLocales(resources, manifestPluginLocales(existingManifest));
  const manifest = {
    version: 1,
    generator: 'gasi-one',
    resources: { ...(existingManifest.resources ?? {}) }
  };

  for (const resource of resources) {
    const key = resourceKey(resource);
    manifest.resources[key] = mergeResourceEntry(manifest.resources[key], {
      name: resource.name,
      pluginName: pluginName(resource),
      packageName: resource.packageName,
      tableName: resource.tableName,
      mode: resource.mode,
      schema: snapshotResource(resource),
      files: [
        ...(targets.includes('api') ? await apiFiles(resource, outputDir, plannedFiles) : []),
        ...(targets.includes('web') ? webFiles(resource) : [])
      ],
      i18n: targets.includes('api') ? i18nEntries(resource, i18nLocalesByPlugin.get(pluginName(resource)) ?? ['en']) : []
    }, targets);
  }

  manifest.resources = sortObject(manifest.resources);

  return {
    target: 'manifest',
    path: manifestPath,
    template: 'manifest.json.hbs',
    context: {
      content: JSON.stringify(manifest, null, 2)
    }
  };
}

export async function readManifest(outputDir) {
  const absolutePath = manifestFilePath(outputDir);
  if (!(await pathExists(absolutePath))) {
    return { version: 1, generator: 'gasi-one', resources: {} };
  }

  return readJson(absolutePath);
}

export async function writeManifest(outputDir, manifest) {
  await writeTextFile(manifestFilePath(outputDir), `${JSON.stringify({
    version: 1,
    generator: 'gasi-one',
    resources: sortObject(manifest.resources ?? {})
  }, null, 2)}\n`);
}

function mergeResourceEntry(existing = {}, generated, targets) {
  const existingFiles = existing.files ?? [];
  const generatedFiles = generated.files ?? [];
  const replacedTargets = new Set(targets);

  return {
    ...existing,
    name: generated.name,
    pluginName: generated.pluginName,
    packageName: generated.packageName,
    tableName: generated.tableName,
    mode: generated.mode,
    schema: targets.includes('api') ? generated.schema : existing.schema ?? generated.schema,
    files: mergeFiles(existingFiles, generatedFiles, replacedTargets),
    i18n: targets.includes('api') ? generated.i18n : existing.i18n ?? []
  };
}

function mergeFiles(existingFiles, generatedFiles, replacedTargets) {
  const generatedPaths = new Set(generatedFiles.map((file) => file.path));
  const preserved = existingFiles.filter((file) => !replacedTargets.has(file.target) || generatedPaths.has(file.path));
  const filesByPath = new Map([...preserved, ...generatedFiles].map((file) => [file.path, file]));
  return [...filesByPath.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

async function apiFiles(resource, outputDir, plannedFiles) {
  const basePath = `src/main/java/${packageToPath(resource.packageName)}`;
  const className = resource.name;
  const files = [
    javaFile(`${basePath}/application/dto/${className}SummaryResponse.java`),
    javaFile(`${basePath}/application/dto/${className}DetailResponse.java`),
    javaFile(`${basePath}/application/mapper/${className}DtoMapper.java`),
    javaFile(`${basePath}/domain/model/${className}.java`),
    ...generatedEnumFiles(resource),
    javaFile(`${basePath}/infrastructure/entity/${className}Entity.java`),
    javaFile(`${basePath}/infrastructure/mapper/${className}Mapper.java`),
    ...(await migrationFiles(resource, outputDir, plannedFiles))
  ];

  if (resource.mode !== 'read') {
    files.push(
      javaFile(`${basePath}/application/dto/${className}CreateRequest.java`),
      javaFile(`${basePath}/application/dto/${className}UpdateRequest.java`)
    );
  }

  if (resource.mode !== 'embed') {
    files.push(
      javaFile(`${basePath}/presentation/controller/${className}Controller.java`),
      javaFile(`${basePath}/application/service/${className}ServiceImpl.java`),
      ...serviceHookFiles(resource),
      javaFile(`${basePath}/domain/port/inbound/${className}Service.java`),
      javaFile(`${basePath}/domain/port/outbound/${className}RepositoryPort.java`),
      javaFile(`${basePath}/infrastructure/adapter/${className}RepositoryAdapter.java`),
      javaFile(`${basePath}/infrastructure/persistence/${className}EntityRepository.java`)
    );
  }

  return files;
}

function serviceHookFiles(resource) {
  if (resource.mode !== 'crud') return [];
  if (!resource.fields.some((field) => field.relation?.type === 'many-to-one')) return [];
  return [javaFile(`src/main/java/${packageToPath(resource.packageName)}/application/hook/${resource.name}ServiceHook.java`)];
}

function generatedEnumFiles(resource) {
  const basePath = `src/main/java/${packageToPath(resource.packageName)}/domain/model`;
  const enums = new Map();

  for (const field of resource.fields) {
    if (field.enum?.generated) enums.set(field.enum.name, field.enum);
  }

  return [...enums.values()].map((enumDefinition) => javaFile(`${basePath}/${enumDefinition.name}.java`));
}

function webFiles(resource) {
  const basePath = `web/src/features/${featurePathFromPackage(resource.packageName)}`;
  const className = resource.name;
  return [
    webFile(`${basePath}/${className}Types.ts`),
    webFile(`${basePath}/${className}Api.ts`),
    webFile(`${basePath}/${className}List.tsx`),
    webFile(`${basePath}/${className}Form.tsx`),
    webFile(`${basePath}/${className}Detail.tsx`)
  ];
}

async function migrationFiles(resource, outputDir, plannedFiles) {
  const migrationDir = path.join(outputDir, 'src/main/resources/db/migration', pluginName(resource));
  const files = await listFiles(migrationDir);
  const plannedMigrationFiles = plannedFiles
    .map((file) => file.path)
    .filter((filePath) =>
      filePath.startsWith(`src/main/resources/db/migration/${pluginName(resource)}/`) &&
      (filePath.endsWith(`__create_${resource.tableName}.sql`) || filePath.endsWith(`__alter_${resource.tableName}.sql`))
    )
    .map((filePath) => path.basename(filePath));

  return [...new Set([...files, ...plannedMigrationFiles])]
    .filter((file) => file.endsWith(`__create_${resource.tableName}.sql`) || file.endsWith(`__alter_${resource.tableName}.sql`))
    .sort()
    .map((file) => ({
      path: `src/main/resources/db/migration/${pluginName(resource)}/${file}`,
      kind: 'migration',
      target: 'api',
      strategy: file.includes('__create_') ? 'create-once' : 'alter-on-change',
      cleanup: true
    }));
}

function i18nEntries(resource, locales) {
  const allLocales = new Set(['default', ...locales]);
  return [...allLocales].sort().map((locale) => ({
    path: `src/main/resources/i18n/${pluginName(resource)}/${locale === 'default' ? 'messages.properties' : `messages_${locale}.properties`}`,
    locale,
    kind: 'i18n',
    strategy: 'merge-properties',
    cleanup: false,
    keys: i18nKeys(resource)
  }));
}

function pluginLocales(resources, existingLocalesByPlugin = new Map()) {
  const grouped = new Map([...existingLocalesByPlugin.entries()].map(([name, locales]) => [name, new Set(locales)]));

  for (const resource of resources) {
    const name = pluginName(resource);
    if (!grouped.has(name)) grouped.set(name, new Set());
    for (const locale of Object.keys(resource.i18n ?? {})) {
      grouped.get(name).add(locale);
    }
  }

  for (const locales of grouped.values()) {
    if (locales.size === 0) locales.add('en');
  }

  return new Map([...grouped.entries()].map(([name, locales]) => [name, [...locales].sort()]));
}

function manifestPluginLocales(manifest) {
  const grouped = new Map();

  for (const resource of Object.values(manifest.resources ?? {})) {
    const name = resource.pluginName;
    if (!name) continue;
    if (!grouped.has(name)) grouped.set(name, new Set());
    for (const entry of resource.i18n ?? []) {
      if (entry.locale && entry.locale !== 'default') grouped.get(name).add(entry.locale);
    }
  }

  return new Map([...grouped.entries()].map(([name, locales]) => [name, [...locales].sort()]));
}

function i18nKeys(resource) {
  const prefix = `${pluginName(resource)}.${resource.variableName}`;
  const keys = [
    `${prefix}.label`,
    `${prefix}.labelPlural`,
    ...resource.fields.map((field) => `${prefix}.field.${field.name}`)
  ];

  for (const localeMessages of Object.values(resource.i18n ?? {})) {
    for (const [fieldName, rules] of Object.entries(localeMessages.validation ?? {})) {
      for (const ruleName of Object.keys(rules)) {
        keys.push(`${prefix}.validation.${fieldName}.${ruleName}`);
      }
    }
  }

  return [...new Set(keys)].sort();
}

function javaFile(filePath) {
  return {
    path: filePath,
    kind: 'java',
    target: 'api',
    strategy: 'overwrite',
    cleanup: true
  };
}

function webFile(filePath) {
  return {
    path: filePath,
    kind: 'react',
    target: 'web',
    strategy: 'overwrite',
    cleanup: true
  };
}
