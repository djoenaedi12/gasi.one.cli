import { packageToPath } from '../../core/naming.js';
import { buildResourceApiContext } from './api/context.js';
import { buildI18nFiles } from './api/i18n.js';
import { buildAlterMigration } from './api/migration.js';

export function createResourceApiFiles(resource, options = {}) {
  const context = buildResourceApiContext(resource, options);
  const basePath = `src/main/java/${packageToPath(resource.packageName)}`;
  const className = resource.name;
  const files = [
    file(`${basePath}/application/dto/${className}SummaryResponse.java`, 'resource/api/summary-response-dto.java.hbs', context),
    file(`${basePath}/application/dto/${className}DetailResponse.java`, 'resource/api/detail-response-dto.java.hbs', context),
    file(`${basePath}/application/mapper/${className}DtoMapper.java`, 'resource/api/dto-mapper.java.hbs', context),
    file(`${basePath}/domain/model/${className}.java`, 'resource/api/model.java.hbs', context),
    file(`${basePath}/infrastructure/entity/${className}Entity.java`, 'resource/api/entity.java.hbs', context),
    file(`${basePath}/infrastructure/mapper/${className}Mapper.java`, 'resource/api/entity-mapper.java.hbs', context)
  ];

  if (resource.mode !== 'read') {
    files.push(
      file(`${basePath}/application/dto/${className}CreateRequest.java`, 'resource/api/create-request-dto.java.hbs', context),
      file(`${basePath}/application/dto/${className}UpdateRequest.java`, 'resource/api/update-request-dto.java.hbs', context)
    );
  }

  if (resource.mode !== 'embed') {
    files.push(
      file(`${basePath}/presentation/controller/${className}Controller.java`, 'resource/api/controller.java.hbs', context),
      file(`${basePath}/application/service/${className}ServiceImpl.java`, 'resource/api/service-impl.java.hbs', context),
      file(`${basePath}/domain/port/inbound/${className}Service.java`, 'resource/api/service-port.java.hbs', context),
      file(`${basePath}/domain/port/outbound/${className}RepositoryPort.java`, 'resource/api/repository-port.java.hbs', context),
      file(`${basePath}/infrastructure/adapter/${className}RepositoryAdapter.java`, 'resource/api/repository-adapter.java.hbs', context),
      file(`${basePath}/infrastructure/persistence/${className}EntityRepository.java`, 'resource/api/entity-repository.java.hbs', context)
    );
  }

  if (context.nestedParent && resource.mode !== 'embed') {
    files.push(file(
      `${basePath}/presentation/hook/${className}ControllerHook.java`,
      'resource/api/controller-hook.java.hbs',
      context
    ));
  }

  if (context.serviceRelationHook) {
    files.push(file(
      `${basePath}/application/hook/${className}ServiceHook.java`,
      'resource/api/service-hook.java.hbs',
      context
    ));
  }

  files.push(...createGeneratedEnumFiles(context));

  if (options.includeCreateMigration !== false) {
    files.push(file(`src/main/resources/db/migration/${context.migration.pluginName}/${context.migration.fileName}`, 'resource/api/migration.sql.hbs', context));
  }

  return files;
}

function createGeneratedEnumFiles(context) {
  const enums = new Map();

  for (const field of context.fields) {
    if (field.enum?.generated) enums.set(`${field.enum.packageName}.${field.enum.name}`, field.enum);
  }

  return [...enums.values()].map((enumDefinition) =>
    file(
      `src/main/java/${packageToPath(enumDefinition.packageName)}/${enumDefinition.name}.java`,
      'resource/api/enum.java.hbs',
      { enum: enumDefinition }
    )
  );
}

export function createResourceApiAlterMigrationFile(resource, previousSnapshot, timestamp) {
  const migration = buildAlterMigration(resource, previousSnapshot, timestamp);
  if (!migration) return [];

  return [
    file(
      `src/main/resources/db/migration/${migration.pluginName}/${migration.fileName}`,
      'resource/api/alter-migration.sql.hbs',
      { migration }
    )
  ];
}

export function createResourceApiI18nFiles(resources, options = {}) {
  return buildI18nFiles(resources, options.localesByPlugin).map((i18nFile) =>
    file(
      `src/main/resources/i18n/${i18nFile.pluginName}/${i18nFile.fileName}`,
      'resource/api/messages.properties.hbs',
      i18nFile,
      { writeStrategy: 'merge-properties' }
    )
  );
}

function file(path, template, context, options = {}) {
  return { target: 'api', path, template, context, ...options };
}
