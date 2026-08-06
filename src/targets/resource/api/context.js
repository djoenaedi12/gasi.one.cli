import { buildCreateMigrationContext } from './migration.js';

export function buildResourceApiContext(resource, options = {}) {
  const fields = resource.fields.map((field) => ({
    ...field,
    simple: !field.relation,
    javaAccessor: accessorName(field.propertyName),
    requestAccessor: accessorName(field.requestName),
    responseAccessor: accessorName(field.responseName),
    entityJavaType: field.relation ? field.relation.target : field.javaType,
    requestJavaType: field.relation ? 'Long' : field.javaType,
    responseJavaType: field.relation ? 'Long' : field.javaType,
    annotations: buildFieldAnnotations(field),
    requestAnnotations: buildRequestAnnotations(field)
  }));

  for (const field of fields) {
    field.entityAnnotationBlock = field.annotations.map((annotation) => `    ${annotation}`).join('\n');
    field.requestAnnotationBlock = field.requestAnnotations.map((annotation) => `    ${annotation}`).join('\n');
  }

  const entityImports = buildEntityImports(fields);
  const modelImports = buildModelImports(fields);
  const requestDtoImports = buildRequestDtoImports(fields);
  const responseDtoImports = buildResponseDtoImports(fields);
  const updateRequestDtoImports = [...new Set([...requestDtoImports, 'jakarta.validation.constraints.NotNull'])].sort();

  return {
    resource,
    fields,
    entityImportBlock: importBlock(entityImports),
    modelImportBlock: importBlock(modelImports),
    requestDtoImportBlock: importBlock(requestDtoImports),
    updateRequestDtoImportBlock: importBlock(updateRequestDtoImports),
    responseDtoImportBlock: importBlock(responseDtoImports),
    inboundBaseImport: inboundBaseImport(resource),
    inboundRequestImportBlock: inboundRequestImportBlock(resource),
    inboundExtends: inboundExtends(resource),
    serviceImportBlock: serviceImportBlock(resource),
    serviceBaseImport: serviceBaseImport(resource),
    serviceAuditImport: serviceAuditImport(resource),
    serviceAuditAnnotation: serviceAuditAnnotation(resource),
    serviceRequestImportBlock: serviceRequestImportBlock(resource),
    serviceExtends: serviceExtends(resource),
    serviceFields: '',
    serviceConstructorParams: serviceConstructorParams(resource),
    serviceSuperArgs: serviceSuperArgs(resource),
    serviceConstructorAssignments: '',
    controllerBaseImport: controllerBaseImport(resource),
    controllerApiPath: controllerApiPath(resource),
    controllerRequestImportBlock: controllerRequestImportBlock(resource),
    controllerNestedImportBlock: '',
    controllerClassExtends: controllerClassExtends(resource),
    controllerBody: controllerBody(resource),
    dtoMapperExtraImportBlock: '',
    dtoMapperMappingTargetImport: dtoMapperMappingTargetImport(resource),
    dtoMapperAutowiredImport: '',
    dtoMapperBaseImport: dtoMapperBaseImport(resource),
    dtoMapperRequestImportBlock: dtoMapperRequestImportBlock(resource),
    dtoMapperBaseInterface: dtoMapperBaseInterface(resource),
    dtoMapperIdCodecField: '',
    dtoMapperWriteMethods: dtoMapperWriteMethods(resource),
    dtoMapperSummaryMappings: '',
    dtoMapperDetailMappings: '',
    dtoMapperChildImportBlock: '',
    dtoMapperChildMethods: '',
    migration: buildMigrationContext(resource, options, fields),
    packages: {
      model: `${resource.packageName}.domain.model`,
      inboundPort: `${resource.packageName}.domain.port.inbound`,
      outboundPort: `${resource.packageName}.domain.port.outbound`,
      service: `${resource.packageName}.application.service`,
      dto: `${resource.packageName}.application.dto`,
      dtoMapper: `${resource.packageName}.application.mapper`,
      controller: `${resource.packageName}.presentation.controller`,
      entity: `${resource.packageName}.infrastructure.entity`,
      adapter: `${resource.packageName}.infrastructure.adapter`,
      entityMapper: `${resource.packageName}.infrastructure.mapper`,
      persistence: `${resource.packageName}.infrastructure.persistence`
    }
  };
}

function buildMigrationContext(resource, options, fields) {
  const timestamp = options.migrationTimestamp ?? timestampNow();
  return buildCreateMigrationContext(resource, timestamp, fields);
}

function timestampNow() {
  const date = new Date();
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

function inboundBaseImport(resource) {
  if (resource.mode === 'read') {
    return 'import gasi.one.core.api.resource.port.inbound.BaseReadService;';
  }
  return 'import gasi.one.core.api.resource.port.inbound.BaseService;';
}

function inboundRequestImportBlock(resource) {
  if (resource.mode === 'read') return '';
  return [
    `import ${resource.packageName}.application.dto.${resource.name}CreateRequest;`,
    `import ${resource.packageName}.application.dto.${resource.name}UpdateRequest;`,
    `import ${resource.packageName}.domain.model.${resource.name};`
  ].join('\n');
}

function inboundExtends(resource) {
  if (resource.mode === 'read') {
    return `BaseReadService<${resource.name}SummaryResponse, ${resource.name}DetailResponse>`;
  }
  return `BaseService<${resource.name}, ${resource.name}CreateRequest, ${resource.name}UpdateRequest, ${resource.name}SummaryResponse, ${resource.name}DetailResponse>`;
}

function serviceImportBlock(resource) {
  const imports = new Set([
    'org.springframework.stereotype.Service',
    'gasi.one.core.api.common.id.IdCodec',
    'gasi.one.core.starter.application.hook.ResourceMapperHookRegistry',
    'gasi.one.core.starter.application.hook.ResourceServiceHookRegistry',
    'gasi.one.core.starter.infrastructure.i18n.MessageUtil'
  ]);

  return importBlock([...imports].sort());
}

function serviceBaseImport(resource) {
  if (resource.mode === 'read') {
    return 'import gasi.one.core.starter.application.service.BaseReadServiceImpl;';
  }
  return 'import gasi.one.core.starter.application.service.BaseServiceImpl;';
}

function serviceAuditImport(resource) {
  if (resource.mode === 'read') return '';
  return 'import gasi.one.core.api.audit.AuditResource;';
}

function serviceAuditAnnotation(resource) {
  if (resource.mode === 'read') return '';
  return `@AuditResource(module = "${moduleName(resource)}", resourceType = "${resource.name}")`;
}

function serviceRequestImportBlock(resource) {
  if (resource.mode === 'read') return '';
  return [
    `import ${resource.packageName}.application.dto.${resource.name}CreateRequest;`,
    `import ${resource.packageName}.application.dto.${resource.name}UpdateRequest;`
  ].join('\n');
}

function serviceExtends(resource) {
  if (resource.mode === 'read') {
    return `BaseReadServiceImpl<${resource.name}, ${resource.name}SummaryResponse, ${resource.name}DetailResponse>`;
  }
  return `BaseServiceImpl<${resource.name}, ${resource.name}CreateRequest, ${resource.name}UpdateRequest, ${resource.name}SummaryResponse, ${resource.name}DetailResponse>`;
}

function serviceConstructorParams(resource) {
  const params = [
    `${resource.name}RepositoryPort repositoryPort`,
    `${resource.name}DtoMapper dtoMapper`,
    'MessageUtil messageUtil',
    'IdCodec idCodec',
    'ResourceServiceHookRegistry hookRegistry',
    'ResourceMapperHookRegistry mapperHookRegistry'
  ];

  return params.join(',\n            ');
}

function serviceSuperArgs(resource) {
  const args = [
    'repositoryPort',
    'dtoMapper',
    'messageUtil',
    'idCodec',
    'hookRegistry',
    'mapperHookRegistry'
  ];

  return args.join(', ');
}

function moduleName(resource) {
  if (resource.pluginName) return resource.pluginName;
  const parts = resource.packageName.split('.');
  const oneIndex = parts.findIndex((part, index) => part === 'one' && parts[index - 1] === 'gasi');
  return parts[oneIndex + 1] ?? parts.at(-2) ?? resource.name;
}

function controllerBaseImport(resource) {
  if (resource.mode === 'read') {
    return 'import gasi.one.core.starter.presentation.controller.BaseReadController;';
  }
  return 'import gasi.one.core.starter.presentation.controller.BaseController;';
}

function controllerApiPath(resource) {
  return resource.endpoint.replace(/^\/+/, '');
}

function controllerRequestImportBlock(resource) {
  if (resource.mode === 'read') return '';
  return [
    `import ${resource.packageName}.application.dto.${resource.name}CreateRequest;`,
    `import ${resource.packageName}.application.dto.${resource.name}UpdateRequest;`,
    `import ${resource.packageName}.domain.model.${resource.name};`
  ].join('\n');
}

function controllerClassExtends(resource) {
  if (resource.mode === 'read') {
    return ` extends\n        BaseReadController<${resource.name}SummaryResponse, ${resource.name}DetailResponse>`;
  }
  return ` extends\n        BaseController<${resource.name}, ${resource.name}CreateRequest, ${resource.name}UpdateRequest, ${resource.name}SummaryResponse, ${resource.name}DetailResponse>`;
}

function controllerBody(resource) {
  const ctor = resource.mode === 'read'
    ? `    public ${resource.name}Controller(${resource.name}Service service, IdCodec idCodec,
            ResourceControllerHookRegistry hookRegistry) {
        super(service, idCodec, hookRegistry);
    }`
    : `    public ${resource.name}Controller(${resource.name}Service service, IdCodec idCodec,
            ResourceControllerHookRegistry hookRegistry) {
        super(service, idCodec, hookRegistry);
    }`;

  return `${ctor}

    @Override
    public String resourceType() {
        return "${resource.name}";
    }`;
}

function dtoMapperMappingTargetImport(resource) {
  if (resource.mode === 'read') return '';
  return 'import org.mapstruct.MappingTarget;';
}

function dtoMapperBaseImport(resource) {
  if (resource.mode === 'read') {
    return 'import gasi.one.core.starter.application.mapper.BaseReadDtoMapper;';
  }
  return 'import gasi.one.core.starter.application.mapper.BaseDtoMapper;';
}

function dtoMapperRequestImportBlock(resource) {
  if (resource.mode === 'read') return '';
  return [
    `import ${resource.packageName}.application.dto.${resource.name}CreateRequest;`,
    `import ${resource.packageName}.application.dto.${resource.name}UpdateRequest;`
  ].join('\n');
}

function dtoMapperBaseInterface(resource) {
  if (resource.mode === 'read') {
    return `BaseReadDtoMapper<${resource.name}, ${resource.name}SummaryResponse, ${resource.name}DetailResponse>`;
  }
  return `BaseDtoMapper<${resource.name}, ${resource.name}CreateRequest, ${resource.name}UpdateRequest, ${resource.name}SummaryResponse, ${resource.name}DetailResponse>`;
}

function dtoMapperWriteMethods(resource) {
  if (resource.mode === 'read') return '';

  return `    @Override
    public abstract ${resource.name} toCreateDomain(${resource.name}CreateRequest request);

    @Override
    public abstract ${resource.name} toUpdateDomain(${resource.name}UpdateRequest request);

    @Override
    public abstract void updateDomain(${resource.name}UpdateRequest request, @MappingTarget ${resource.name} domain);

    @Override
    public abstract ${resource.name} cloneDomain(${resource.name} source);

    @Override
    public abstract void copyDomain(${resource.name} source, @MappingTarget ${resource.name} target);`;
}

function buildFieldAnnotations(field) {
  const annotations = [];
  let column = `@Column(name = "${field.columnName}"`;
  if (field.required) column += ', nullable = false';
  if (field.unique) column += ', unique = true';
  if (field.length) column += `, length = ${field.length}`;
  if (field.precision) column += `, precision = ${field.precision}`;
  if (field.scale) column += `, scale = ${field.scale}`;
  column += ')';

  if (field.relation) {
    annotations.push(`@ManyToOne(fetch = FetchType.${field.relation.fetch.toUpperCase()})`);
    annotations.push(`@JoinColumn(name = "${field.relation.joinColumn || field.columnName}", nullable = ${field.required ? 'false' : 'true'})`);
  } else if (field.type === 'enum') {
    annotations.push('@Enumerated(EnumType.STRING)');
    annotations.push(column);
  } else {
    annotations.push(column);
  }
  return annotations;
}

function buildRequestAnnotations(field) {
  const annotations = [];
  const validation = field.validation;
  const stringLike = ['string', 'text'].includes(field.type);

  if (field.required && stringLike) annotations.push('@NotBlank');
  if (field.required && !stringLike) annotations.push('@NotNull');
  if (validation.email) annotations.push('@Email');
  if (validation.minLength || validation.maxLength) {
    const args = [];
    if (validation.minLength) args.push(`min = ${validation.minLength}`);
    if (validation.maxLength) args.push(`max = ${validation.maxLength}`);
    annotations.push(`@Size(${args.join(', ')})`);
  }
  if (validation.pattern) annotations.push(`@Pattern(regexp = "${escapeJava(validation.pattern)}")`);
  if (validation.positive) annotations.push('@Positive');
  if (validation.positiveOrZero) annotations.push('@PositiveOrZero');
  if (validation.negative) annotations.push('@Negative');
  if (validation.negativeOrZero) annotations.push('@NegativeOrZero');
  if (validation.past) annotations.push('@Past');
  if (validation.pastOrPresent) annotations.push('@PastOrPresent');
  if (validation.future) annotations.push('@Future');
  if (validation.futureOrPresent) annotations.push('@FutureOrPresent');

  return annotations;
}

function buildEntityImports(fields) {
  const imports = new Set(['jakarta.persistence.Column']);

  for (const field of fields) {
    if (field.javaType === 'BigDecimal') imports.add('java.math.BigDecimal');
    if (field.javaType === 'LocalDate') imports.add('java.time.LocalDate');
    if (field.javaType === 'LocalDateTime') imports.add('java.time.LocalDateTime');
    if (field.javaType === 'Instant') imports.add('java.time.Instant');
    if (field.javaType === 'UUID') imports.add('java.util.UUID');
    if (field.type === 'enum') imports.add('jakarta.persistence.EnumType');
    if (field.type === 'enum') imports.add('jakarta.persistence.Enumerated');
    if (field.relation) {
      imports.add('jakarta.persistence.FetchType');
      imports.add('jakarta.persistence.JoinColumn');
      imports.add('jakarta.persistence.ManyToOne');
      imports.add(`${field.relation.packageName}.infrastructure.entity.${field.relation.target}Entity`);
    }
  }

  return [...imports].sort();
}

function buildModelImports(fields) {
  const imports = new Set();

  for (const field of fields) {
    if (field.javaType === 'BigDecimal') imports.add('java.math.BigDecimal');
    if (field.javaType === 'LocalDate') imports.add('java.time.LocalDate');
    if (field.javaType === 'LocalDateTime') imports.add('java.time.LocalDateTime');
    if (field.javaType === 'Instant') imports.add('java.time.Instant');
    if (field.javaType === 'UUID') imports.add('java.util.UUID');
    if (field.relation) imports.add(`${field.relation.packageName}.domain.model.${field.relation.target}`);
  }

  return [...imports].sort();
}

function buildRequestDtoImports(fields) {
  const imports = new Set();

  for (const field of fields) {
    if (field.requestJavaType === 'BigDecimal') imports.add('java.math.BigDecimal');
    if (field.requestJavaType === 'LocalDate') imports.add('java.time.LocalDate');
    if (field.requestJavaType === 'LocalDateTime') imports.add('java.time.LocalDateTime');
    if (field.requestJavaType === 'Instant') imports.add('java.time.Instant');
    if (field.requestJavaType === 'UUID') imports.add('java.util.UUID');
    for (const annotation of field.requestAnnotations) {
      const name = annotation.match(/^@([A-Za-z]+)/)?.[1];
      if (name) imports.add(`jakarta.validation.constraints.${name}`);
    }
  }

  return [...imports].sort();
}

function buildResponseDtoImports(fields) {
  const imports = new Set();

  for (const field of fields) {
    if (field.responseJavaType === 'BigDecimal') imports.add('java.math.BigDecimal');
    if (field.responseJavaType === 'LocalDate') imports.add('java.time.LocalDate');
    if (field.responseJavaType === 'LocalDateTime') imports.add('java.time.LocalDateTime');
    if (field.responseJavaType === 'Instant') imports.add('java.time.Instant');
    if (field.responseJavaType === 'UUID') imports.add('java.util.UUID');
  }

  return [...imports].sort();
}

function accessorName(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeJava(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function importBlock(imports) {
  return imports.map((item) => `import ${item};`).join('\n');
}
