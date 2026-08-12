import {
  camelCase,
  kebabCase,
  pascalCase,
  pluralKebabCase,
  pluralSnakeCase,
  snakeCase,
  titleCase
} from '../../core/naming.js';
import { fieldTypes } from './types.js';

export function normalizeResourceDocument(rawDocument) {
  if (!rawDocument || typeof rawDocument !== 'object') {
    throw new Error('Resource schema must be a JSON object.');
  }

  const rawResources = Array.isArray(rawDocument)
    ? rawDocument
    : rawDocument.resources ?? [rawDocument];

  if (!Array.isArray(rawResources) || rawResources.length === 0) {
    throw new Error('Resource schema must contain at least one resource.');
  }

  const resources = rawResources.map(normalizeResource);
  resolveParents(resources);
  resolveRelationTables(resources);

  return { resources };
}

function normalizeResource(rawResource) {
  const rawName = rawResource.name ?? rawResource.entityName;
  const name = pascalCase(rawName ?? '');
  const fields = rawResource.fields ?? [];
  const mode = rawResource.mode ?? 'crud';
  const parent = normalizeParent(rawResource.parent);
  if (mode === 'embed' && parent && !rawResource.parent?.field) {
    parent.field = camelCase(pluralKebabCase(name));
  }

  return {
    name,
    variableName: camelCase(name),
    pluginName: rawResource.pluginName ?? null,
    packageName: rawResource.package ?? '',
    mode,
    tableName: rawResource.table || pluralSnakeCase(name),
    endpoint: rawResource.endpoint || `/${pluralKebabCase(name)}`,
    routePath: pluralKebabCase(name),
    title: titleCase(name),
    lookup: rawResource.lookup ?? false,
    parent,
    fields: fields.map(normalizeField),
    i18n: rawResource.i18n ?? {}
  };
}

function normalizeParent(rawParent) {
  if (!rawParent) return null;

  const resource = pascalCase(rawParent.resource ?? '');
  const field = rawParent.field ? camelCase(rawParent.field) : camelCase(resource);

  return {
    resource,
    packageName: rawParent.package ?? '',
    endpoint: rawParent.endpoint ?? '',
    route: String(rawParent.route ?? '').toLowerCase(),
    pathParam: rawParent.pathParam ?? `${field}Id`,
    field,
    joinColumn: rawParent.joinColumn ?? `${snakeCase(field)}_id`,
    table: rawParent.table ?? ''
  };
}

function normalizeField(rawField) {
  const type = String(rawField.type ?? '').toLowerCase();
  const typeInfo = fieldTypes[type] ?? {};
  const name = camelCase(rawField.name ?? '');
  const enumDefinition = normalizeEnum(rawField.enum);
  const relation = normalizeRelation(rawField.relation);

  return {
    name,
    propertyName: relation ? camelCase(rawField.name) : name,
    requestName: relation ? `${camelCase(rawField.name)}Id` : name,
    responseName: relation ? `${camelCase(rawField.name)}Id` : name,
    label: titleCase(name),
    type,
    javaType: enumDefinition?.name ?? typeInfo.javaType,
    tsType: typeInfo.tsType ?? 'string',
    inputType: typeInfo.inputType ?? 'text',
    columnName: rawField.column || snakeCase(name),
    length: rawField.length ?? null,
    precision: rawField.precision ?? null,
    scale: rawField.scale ?? null,
    required: Boolean(rawField.required),
    unique: Boolean(rawField.unique),
    defaultValue: rawField.defaultValue ?? null,
    validation: rawField.validation ?? {},
    dto: normalizeDto(rawField.dto),
    projection: Boolean(rawField.projection),
    relation,
    enum: enumDefinition
  };
}

function normalizeDto(rawDto = {}) {
  return {
    create: rawDto.create ?? true,
    update: rawDto.update ?? true,
    summary: rawDto.summary ?? true,
    detail: rawDto.detail ?? true
  };
}

function normalizeEnum(rawEnum) {
  if (!rawEnum) return null;

  const values = rawEnum.values ?? [];
  const constants = Array.isArray(values) ? values : [];

  return {
    name: rawEnum.name ? pascalCase(rawEnum.name) : '',
    packageName: rawEnum.package ?? '',
    values,
    persistenceType: String(rawEnum.type ?? 'ordinal').toLowerCase(),
    generated: !rawEnum.package,
    constantsBlock: constants.map((value, index) => `    ${String(value)}${index === constants.length - 1 ? ';' : ','}`).join('\n'),
    constants: constants.map((value, index) => ({
      name: String(value),
      suffix: index === constants.length - 1 ? ';' : ','
    }))
  };
}

function normalizeRelation(rawRelation) {
  if (!rawRelation || !rawRelation.type) return null;

  return {
    type: String(rawRelation.type).toLowerCase(),
    target: rawRelation.target ?? '',
    packageName: rawRelation.package ?? '',
    labelField: rawRelation.labelField ?? rawRelation.displayField ?? '',
    table: rawRelation.table ?? '',
    joinColumn: rawRelation.joinColumn ?? '',
    mappedBy: rawRelation.mappedBy ?? '',
    fetch: String(rawRelation.fetch ?? 'lazy').toLowerCase(),
    cascade: rawRelation.cascade ?? [],
    orphanRemoval: Boolean(rawRelation.orphanRemoval)
  };
}

function resolveRelationTables(resources) {
  const resourcesByName = groupResourcesByName(resources);
  const resourcesByPackageAndName = new Map(resources.map((resource) => [`${resource.packageName}.${resource.name}`, resource]));

  for (const resource of resources) {
    for (const field of resource.fields) {
      if (!field.relation || field.relation.table) continue;
      const targetResource = resolveResourceReference({
        resourceName: field.relation.target,
        packageName: field.relation.packageName,
        resourcesByPackageAndName,
        resourcesByName,
        ambiguityMessage: () => `Relation ${resource.name}.${field.name} package is required because target ${field.relation.target} is ambiguous.`
      });
      field.relation.table = targetResource?.tableName ?? pluralSnakeCase(field.relation.target);
    }
  }
}

function resolveParents(resources) {
  const resourcesByName = groupResourcesByName(resources);
  const resourcesByPackageAndName = new Map(resources.map((resource) => [`${resource.packageName}.${resource.name}`, resource]));

  for (const resource of resources) {
    if (!resource.parent) continue;
    const parentResource = resolveResourceReference({
      resourceName: resource.parent.resource,
      packageName: resource.parent.packageName,
      resourcesByPackageAndName,
      resourcesByName,
      ambiguityMessage: () => `Resource ${resource.name} parent.package is required because parent ${resource.parent.resource} is ambiguous.`
    });

    if (parentResource) {
      resource.parent.packageName ||= parentResource.packageName;
      resource.parent.endpoint ||= parentResource.endpoint;
      resource.parent.table ||= parentResource.tableName;
    }

    resource.parent.endpoint ||= `/${pluralKebabCase(resource.parent.resource)}`;
    resource.parent.table ||= pluralSnakeCase(resource.parent.resource);
  }
}

function groupResourcesByName(resources) {
  const grouped = new Map();
  for (const resource of resources) {
    if (!grouped.has(resource.name)) grouped.set(resource.name, []);
    grouped.get(resource.name).push(resource);
  }
  return grouped;
}

function resolveResourceReference({
  resourceName,
  packageName,
  resourcesByPackageAndName,
  resourcesByName,
  ambiguityMessage
}) {
  if (packageName) {
    return resourcesByPackageAndName.get(`${packageName}.${resourceName}`) ?? null;
  }

  const candidates = resourcesByName.get(resourceName) ?? [];
  if (candidates.length > 1) throw new Error(ambiguityMessage());
  return candidates[0] ?? null;
}
