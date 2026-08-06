import { pluralSnakeCase } from '../../../core/naming.js';

export function snapshotResource(resource) {
  return {
    name: resource.name,
    pluginName: pluginName(resource),
    packageName: resource.packageName,
    tableName: resource.tableName,
    fields: resource.fields.map(snapshotField)
  };
}

export function resourceKey(resource) {
  return `${resource.packageName}.${resource.name}`;
}

export function buildSchemaState(resources) {
  return {
    version: 1,
    generator: 'gasi-one',
    resources: Object.fromEntries(resources.map((resource) => [resourceKey(resource), snapshotResource(resource)]))
  };
}

export function buildAlterMigration(resource, previousSnapshot, timestamp) {
  const currentSnapshot = snapshotResource(resource);
  const changes = diffFields(previousSnapshot, currentSnapshot);
  if (changes.length === 0) return null;

  return {
    pluginName: currentSnapshot.pluginName,
    fileName: `V${timestamp}__alter_${currentSnapshot.tableName}.sql`,
    tableName: currentSnapshot.tableName,
    statementsSql: changes.map((change) => renderChange(currentSnapshot, change)).join('\n\n')
  };
}

export function buildCreateMigrationContext(resource, timestamp, fields) {
  const resourceSnapshot = snapshotResource(resource);

  return {
    pluginName: resourceSnapshot.pluginName,
    timestamp,
    tableName: resource.tableName,
    fileName: `V${timestamp}__create_${resource.tableName}.sql`,
    columnsSql: buildCreateColumns(resource, fields),
    fkConstraintsSql: buildCreateFkConstraints(resource, fields)
  };
}

export function sqlType(field) {
  if (field.relation) return 'BIGINT';
  if (field.type === 'string') return `VARCHAR(${field.length || 255})`;
  if (field.type === 'text') return 'TEXT';
  if (field.type === 'integer') return 'INT';
  if (field.type === 'long') return 'BIGINT';
  if (field.type === 'decimal') return `DECIMAL(${field.precision || 19}, ${field.scale ?? 4})`;
  if (field.type === 'double') return 'DOUBLE';
  if (field.type === 'boolean') return 'BOOLEAN';
  if (field.type === 'date') return 'DATE';
  if (field.type === 'datetime') return 'DATETIME(6)';
  if (field.type === 'instant') return 'TIMESTAMP(6)';
  if (field.type === 'uuid') return 'CHAR(36)';
  if (field.type === 'enum') return 'VARCHAR(50)';
  return 'VARCHAR(255)';
}

function snapshotField(field) {
  return {
    name: field.name,
    columnName: field.relation ? field.relation.joinColumn || field.columnName : field.columnName,
    type: field.type,
    length: field.length,
    precision: field.precision,
    scale: field.scale,
    required: field.required,
    unique: field.unique,
    defaultValue: field.defaultValue,
    relation: field.relation
      ? {
          type: field.relation.type,
          target: field.relation.target,
          packageName: field.relation.packageName,
          joinColumn: field.relation.joinColumn || field.columnName
        }
      : null
  };
}

function diffFields(previousSnapshot, currentSnapshot) {
  const changes = [];
  const previousFields = new Map((previousSnapshot?.fields ?? []).map((field) => [field.name, field]));
  const currentFields = new Map(currentSnapshot.fields.map((field) => [field.name, field]));

  for (const field of currentSnapshot.fields) {
    const previousField = previousFields.get(field.name);
    if (!previousField) {
      changes.push({ type: 'add', field });
    } else if (stableString(previousField) !== stableString(field)) {
      changes.push({ type: 'modify', field, previousField });
    }
  }

  for (const field of previousSnapshot?.fields ?? []) {
    if (!currentFields.has(field.name)) {
      changes.push({ type: 'drop', field });
    }
  }

  return changes;
}

function renderChange(resourceSnapshot, change) {
  if (change.type === 'add') return renderAddColumn(resourceSnapshot, change.field);
  if (change.type === 'modify') return renderModifyColumn(resourceSnapshot, change.field, change.previousField);
  return renderDropColumn(resourceSnapshot, change.field);
}

function renderAddColumn(resourceSnapshot, field) {
  const statements = [
    `ALTER TABLE ${resourceSnapshot.tableName}
    ADD COLUMN ${columnDefinition(field)};`
  ];

  if (field.unique) {
    statements.push(`ALTER TABLE ${resourceSnapshot.tableName}
    ADD CONSTRAINT uk_${resourceSnapshot.tableName}_${field.columnName} UNIQUE (${field.columnName});`);
  }

  if (field.relation) {
    statements.push(fkStatement(resourceSnapshot.tableName, field));
  }

  return statements.join('\n\n');
}

function renderModifyColumn(resourceSnapshot, field, previousField) {
  const statements = [];

  if (previousField?.columnName !== field.columnName) {
    statements.push(`ALTER TABLE ${resourceSnapshot.tableName}
    CHANGE COLUMN ${previousField.columnName} ${columnDefinition(field)};`);
  } else {
    statements.push(`ALTER TABLE ${resourceSnapshot.tableName}
    MODIFY COLUMN ${columnDefinition(field)};`);
  }

  if (!previousField?.unique && field.unique) {
    statements.push(`ALTER TABLE ${resourceSnapshot.tableName}
    ADD CONSTRAINT uk_${resourceSnapshot.tableName}_${field.columnName} UNIQUE (${field.columnName});`);
  }

  if (!previousField?.relation && field.relation) {
    statements.push(fkStatement(resourceSnapshot.tableName, field));
  }

  return statements.join('\n\n');
}

function renderDropColumn(resourceSnapshot, field) {
  const statements = [];

  if (field.relation) {
    statements.push(`ALTER TABLE ${resourceSnapshot.tableName}
    DROP FOREIGN KEY fk_${resourceSnapshot.tableName}_${field.columnName};`);
  }

  statements.push(`ALTER TABLE ${resourceSnapshot.tableName}
    DROP COLUMN ${field.columnName};`);

  return statements.join('\n\n');
}

function columnDefinition(field) {
  return `${field.columnName} ${sqlType(field)}${field.required ? ' NOT NULL' : ''}${sqlDefault(field)}`;
}

function fkStatement(tableName, field) {
  return `ALTER TABLE ${tableName}
    ADD CONSTRAINT fk_${tableName}_${field.columnName}
    FOREIGN KEY (${field.columnName}) REFERENCES ${pluralSnakeCase(field.relation.target)}(id);`;
}

function buildCreateColumns(resource, fields) {
  const columnLines = [];
  const constraintLines = [];

  for (const field of fields) {
    const columnName = field.relation ? field.relation.joinColumn || field.columnName : field.columnName;
    columnLines.push(`    ${columnName} ${sqlType(field)}${field.required ? ' NOT NULL' : ''}${sqlDefault(field)}`);
    if (field.unique) {
      constraintLines.push(`    CONSTRAINT uk_${resource.tableName}_${columnName} UNIQUE (${columnName})`);
    }
  }

  const lines = [...columnLines, ...constraintLines];
  return lines.length ? ',\n' + lines.join(',\n') : '';
}

function buildCreateFkConstraints(resource, fields) {
  const constraints = fields
    .filter((field) => field.relation?.type === 'many-to-one')
    .map((field) => {
      const columnName = field.relation.joinColumn || field.columnName;
      const targetTable = field.relation.table || pluralSnakeCase(field.relation.target);
      return `ALTER TABLE ${resource.tableName}
    ADD CONSTRAINT fk_${resource.tableName}_${columnName}
    FOREIGN KEY (${columnName}) REFERENCES ${targetTable}(id);`;
    });

  return constraints.join('\n\n');
}

function sqlDefault(field) {
  if (field.defaultValue === null || field.defaultValue === undefined) return '';
  if (typeof field.defaultValue === 'boolean') return ` DEFAULT ${field.defaultValue ? 'TRUE' : 'FALSE'}`;
  if (typeof field.defaultValue === 'number') return ` DEFAULT ${field.defaultValue}`;
  return ` DEFAULT '${escapeSql(field.defaultValue)}'`;
}

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

export function pluginName(resource) {
  if (resource.pluginName) return resource.pluginName;
  const parts = resource.packageName.split('.');
  const oneIndex = parts.findIndex((part, index) => part === 'one' && parts[index - 1] === 'gasi');
  return parts[oneIndex + 1] ?? parts.at(-2) ?? 'app';
}

function stableString(value) {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]));
}
