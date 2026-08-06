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

  return {
    resources: rawResources.map(normalizeResource)
  };
}

function normalizeResource(rawResource) {
  const rawName = rawResource.name ?? rawResource.entityName;
  const name = pascalCase(rawName ?? '');
  const fields = rawResource.fields ?? [];

  return {
    name,
    variableName: camelCase(name),
    pluginName: rawResource.pluginName ?? null,
    packageName: rawResource.package ?? '',
    mode: rawResource.mode ?? 'crud',
    tableName: rawResource.table || pluralSnakeCase(name),
    endpoint: rawResource.endpoint || `/${pluralKebabCase(name)}`,
    routePath: pluralKebabCase(name),
    title: titleCase(name),
    fields: fields.map(normalizeField),
    i18n: rawResource.i18n ?? {}
  };
}

function normalizeField(rawField) {
  const type = String(rawField.type ?? '').toLowerCase();
  const typeInfo = fieldTypes[type] ?? {};
  const name = camelCase(rawField.name ?? '');
  const enumName = rawField.enumName ? pascalCase(rawField.enumName) : null;
  const relation = normalizeRelation(rawField.relation);

  return {
    name,
    propertyName: relation ? camelCase(rawField.name) : name,
    requestName: relation ? `${camelCase(rawField.name)}Id` : name,
    responseName: relation ? `${camelCase(rawField.name)}Id` : name,
    label: rawField.label ?? titleCase(name),
    type,
    javaType: enumName ?? typeInfo.javaType,
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
    relation,
    enumName,
    enumValues: rawField.enumValues ?? []
  };
}

function normalizeRelation(rawRelation) {
  if (!rawRelation || !rawRelation.type) return null;

  return {
    type: String(rawRelation.type).toLowerCase(),
    target: rawRelation.target ?? '',
    packageName: rawRelation.package ?? '',
    joinColumn: rawRelation.joinColumn ?? '',
    mappedBy: rawRelation.mappedBy ?? '',
    fetch: String(rawRelation.fetch ?? 'lazy').toLowerCase(),
    cascade: rawRelation.cascade ?? [],
    orphanRemoval: Boolean(rawRelation.orphanRemoval)
  };
}
