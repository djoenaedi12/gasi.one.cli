import { fieldTypes } from './types.js';

export function validateResourceDocument(document) {
  assertUnique(document.resources.map((resource) => `${resource.packageName}.${resource.name}`), 'resource package/name');

  for (const resource of document.resources) {
    if (!resource.name) throw new Error('Resource name is required.');
    if (resource.pluginName && !/^[a-z][a-z0-9-]*$/.test(resource.pluginName)) {
      throw new Error(`Resource ${resource.name} pluginName must be lowercase and may contain numbers or dashes.`);
    }
    if (!resource.packageName) throw new Error(`Resource ${resource.name} must include package.`);
    if (!/^gasi\.one(\.[a-z][a-z0-9]*)+$/.test(resource.packageName)) {
      throw new Error(`Resource ${resource.name} package must start with gasi.one and use lowercase Java package segments.`);
    }
    if (!['crud', 'read', 'embed'].includes(resource.mode)) {
      throw new Error(`Resource ${resource.name} mode must be crud, read, or embed.`);
    }
    if (typeof resource.lookup !== 'boolean') {
      throw new Error(`Resource ${resource.name} lookup must be boolean.`);
    }
    if (resource.lookup && resource.mode === 'embed') {
      throw new Error(`Resource ${resource.name} lookup cannot be generated for embed mode.`);
    }
    if (resource.lookup && resource.parent?.route === 'nested') {
      throw new Error(`Resource ${resource.name} lookup cannot be generated for nested routes.`);
    }
    if (!Array.isArray(resource.fields) || resource.fields.length === 0) {
      throw new Error(`Resource ${resource.name} must include fields.`);
    }
    if (resource.parent) validateParent(resource);

    assertUnique(resource.fields.map((field) => field.name), `${resource.name} field`);
    for (const field of resource.fields) {
      if (!field.name) throw new Error(`Resource ${resource.name} has a field without name.`);
      if (!field.type) throw new Error(`Field ${resource.name}.${field.name} must include type.`);
      if (!fieldTypes[field.type]) throw new Error(`Field ${resource.name}.${field.name} has unsupported type: ${field.type}.`);
      validateDto(resource, field);
      if (field.projection && field.dto.summary === false) {
        throw new Error(`Field ${resource.name}.${field.name} projection requires dto.summary to be true.`);
      }
      if (field.type === 'enum') validateEnum(resource, field);
      if (field.relation) validateRelation(resource, field);
    }
  }
}

function validateParent(resource) {
  if (!resource.parent.resource) {
    throw new Error(`Resource ${resource.name} parent must include resource.`);
  }
  if (resource.parent.route && !['nested'].includes(resource.parent.route)) {
    throw new Error(`Resource ${resource.name} parent.route currently supports nested only.`);
  }
  if (resource.parent.route === 'nested' || resource.mode === 'embed') {
    const parentRelation = resource.fields.find((field) =>
      field.relation?.type === 'many-to-one' && field.relation.target === resource.parent.resource
    );
    if (!parentRelation) {
      throw new Error(`Resource ${resource.name} must include a many-to-one relation field to parent ${resource.parent.resource}.`);
    }
  }
}

function validateDto(resource, field) {
  for (const [key, value] of Object.entries(field.dto ?? {})) {
    if (!['create', 'update', 'summary', 'detail'].includes(key)) {
      throw new Error(`Field ${resource.name}.${field.name} dto.${key} is not supported.`);
    }
    if (typeof value !== 'boolean') {
      throw new Error(`Field ${resource.name}.${field.name} dto.${key} must be boolean.`);
    }
  }
}

function validateEnum(resource, field) {
  if (!field.enum) {
    throw new Error(`Enum field ${resource.name}.${field.name} must include enum.`);
  }
  if (!field.enum.name) {
    throw new Error(`Enum field ${resource.name}.${field.name} must include enum.name.`);
  }
  if (!['ordinal', 'string'].includes(field.enum.persistenceType)) {
    throw new Error(`Enum field ${resource.name}.${field.name} enum.type must be ordinal or string.`);
  }
  if (field.enum.packageName && !/^gasi\.one(\.[a-z][a-z0-9]*)+$/.test(field.enum.packageName)) {
    throw new Error(`Enum field ${resource.name}.${field.name} enum.package must start with gasi.one and use lowercase Java package segments.`);
  }
  if (!Array.isArray(field.enum.values)) {
    throw new Error(`Enum field ${resource.name}.${field.name} enum.values must be an array.`);
  }
  if (field.enum.generated && field.enum.values.length === 0) {
    throw new Error(`Generated enum field ${resource.name}.${field.name} must include enum.values.`);
  }
  for (const value of field.enum.values) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(String(value))) {
      throw new Error(`Enum field ${resource.name}.${field.name} enum.values must contain uppercase Java enum constants.`);
    }
  }
  if (!field.enum.generated && field.enum.values.length > 0) {
    throw new Error(`Existing enum field ${resource.name}.${field.name} must not include enum.values.`);
  }
}

function validateRelation(resource, field) {
  if (!['many-to-one'].includes(field.relation.type)) {
    throw new Error(`Field ${resource.name}.${field.name} relation type currently supports many-to-one only.`);
  }
  if (!field.relation.target) {
    throw new Error(`Field ${resource.name}.${field.name} relation must include target.`);
  }
  if (!field.relation.packageName) {
    throw new Error(`Field ${resource.name}.${field.name} relation must include package.`);
  }
}

function assertUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}
