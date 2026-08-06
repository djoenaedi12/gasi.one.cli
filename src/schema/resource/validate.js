import { fieldTypes } from './types.js';

export function validateResourceDocument(document) {
  assertUnique(document.resources.map((resource) => resource.name), 'resource name');

  for (const resource of document.resources) {
    if (!resource.name) throw new Error('Resource name is required.');
    if (resource.pluginName && !/^[a-z][a-z0-9-]*$/.test(resource.pluginName)) {
      throw new Error(`Resource ${resource.name} pluginName must be lowercase and may contain numbers or dashes.`);
    }
    if (!resource.packageName) throw new Error(`Resource ${resource.name} must include package.`);
    if (!/^gasi\.one(\.[a-z][a-z0-9]*)+$/.test(resource.packageName)) {
      throw new Error(`Resource ${resource.name} package must start with gasi.one and use lowercase Java package segments.`);
    }
    if (!['crud', 'read'].includes(resource.mode)) {
      throw new Error(`Resource ${resource.name} mode must be crud or read.`);
    }
    if (!Array.isArray(resource.fields) || resource.fields.length === 0) {
      throw new Error(`Resource ${resource.name} must include fields.`);
    }

    assertUnique(resource.fields.map((field) => field.name), `${resource.name} field`);
    for (const field of resource.fields) {
      if (!field.name) throw new Error(`Resource ${resource.name} has a field without name.`);
      if (!field.type) throw new Error(`Field ${resource.name}.${field.name} must include type.`);
      if (!fieldTypes[field.type]) throw new Error(`Field ${resource.name}.${field.name} has unsupported type: ${field.type}.`);
      if (field.type === 'enum' && (!field.enumName || field.enumValues.length === 0)) {
        throw new Error(`Enum field ${resource.name}.${field.name} must include enumName and enumValues.`);
      }
      if (field.relation) validateRelation(resource, field);
    }
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
