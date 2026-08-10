import { buildCreateMigrationContext } from './migration.js';

export function buildResourceApiContext(resource, options = {}) {
  const packages = {
    model: `${resource.packageName}.domain.model`,
    inboundPort: `${resource.packageName}.domain.port.inbound`,
    outboundPort: `${resource.packageName}.domain.port.outbound`,
    service: `${resource.packageName}.application.service`,
    serviceHook: `${resource.packageName}.application.hook`,
    dto: `${resource.packageName}.application.dto`,
    dtoMapper: `${resource.packageName}.application.mapper`,
    controller: `${resource.packageName}.presentation.controller`,
    hook: `${resource.packageName}.presentation.hook`,
    entity: `${resource.packageName}.infrastructure.entity`,
    adapter: `${resource.packageName}.infrastructure.adapter`,
    entityMapper: `${resource.packageName}.infrastructure.mapper`,
    persistence: `${resource.packageName}.infrastructure.persistence`
  };
  const fields = resource.fields.map((field) => {
    const nestedParentRelation = isNestedParentRelation(resource, field);
    const embeddedParentRelation = isEmbeddedParentRelation(resource, field);
    const nextField = {
      ...field,
      nestedParentRelation,
      embeddedParentRelation,
      simple: !field.relation,
      javaAccessor: accessorName(field.propertyName),
      requestAccessor: accessorName(field.requestName),
      responseAccessor: accessorName(field.responseName),
      entityJavaType: field.relation ? field.relation.target : field.javaType,
      requestJavaType: field.relation ? 'Long' : field.javaType,
      responseJavaType: field.relation ? 'Long' : field.javaType
    };
    return {
      ...nextField,
      annotations: buildFieldAnnotations(nextField),
      requestAnnotations: buildRequestAnnotations(nextField)
    };
  });
  const createFields = fields.filter((field) => (field.dto.create || field.nestedParentRelation) && !field.embeddedParentRelation);
  const updateFields = fields.filter((field) => (field.dto.update || field.nestedParentRelation) && !field.embeddedParentRelation);
  const summaryFields = fields.filter((field) => field.dto.summary && !field.embeddedParentRelation);
  const detailFields = fields.filter((field) => field.dto.detail && !field.embeddedParentRelation);
  const projectionFields = fields.filter((field) => field.projection);
  const nestedParent = nestedParentContext(resource, fields);
  const embedChildren = buildEmbedChildren(options.embedChildren ?? []);
  const serviceRelationHook = serviceRelationHookContext(resource, fields, nestedParent);

  for (const field of fields) {
    if (field.enum?.generated) field.enum.packageName = packages.model;
  }

  for (const field of fields) {
    field.entityAnnotationBlock = field.annotations.map((annotation) => `    ${annotation}`).join('\n');
    field.requestAnnotationBlock = field.requestAnnotations.map((annotation) => `    ${annotation}`).join('\n');
  }

  const entityImports = buildEntityImports(fields, packages.entity, embedChildren);
  const modelImports = buildModelImports(fields, packages.model, embedChildren);
  const createRequestDtoImports = buildRequestDtoImports(createFields, packages.dto, embedChildren, 'create');
  const updateRequestDtoImports = [...new Set([...buildRequestDtoImports(updateFields, packages.dto, embedChildren, 'update'), 'jakarta.validation.constraints.NotNull'])].sort();
  const summaryResponseDtoImports = buildResponseDtoImports(summaryFields, packages.dto);
  const detailResponseDtoImports = buildResponseDtoImports(detailFields, packages.dto, embedChildren);
  const controllerImports = buildControllerImports(resource, projectionFields);

  return {
    resource,
    fields,
    modelFields: [...fields, ...embedChildren.map((child) => child.modelField)],
    entityFields: [...fields, ...embedChildren.map((child) => child.entityField)],
    createFields,
    updateFields,
    createEmbedFields: embedChildren.map((child) => child.createField),
    updateEmbedFields: embedChildren.map((child) => child.updateField),
    summaryFields,
    detailFields,
    detailEmbedFields: embedChildren.map((child) => child.detailField),
    embedChildren,
    nestedParent,
    serviceRelationHook,
    entityImportBlock: importBlock(entityImports),
    modelImportBlock: importBlock(modelImports),
    createRequestDtoImportBlock: importBlock(createRequestDtoImports),
    updateRequestDtoImportBlock: importBlock(updateRequestDtoImports),
    summaryResponseDtoImportBlock: importBlock(summaryResponseDtoImports),
    detailResponseDtoImportBlock: importBlock(detailResponseDtoImports),
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
    controllerNestedImportBlock: importBlock(controllerImports),
    controllerClassExtends: controllerClassExtends(resource),
    controllerBody: controllerBody(resource, projectionFields),
    controllerHookRequestImportBlock: controllerHookRequestImportBlock(resource),
    controllerHookGenericTypes: controllerHookGenericTypes(resource),
    controllerHookMutationMethods: controllerHookMutationMethods(resource, nestedParent),
    dtoMapperExtraImportBlock: dtoMapperExtraImportBlock(embedChildren),
    dtoMapperMappingTargetImport: dtoMapperMappingTargetImport(resource),
    dtoMapperAutowiredImport: '',
    dtoMapperBaseImport: dtoMapperBaseImport(resource),
    dtoMapperRequestImportBlock: dtoMapperRequestImportBlock(resource),
    dtoMapperBaseInterface: dtoMapperBaseInterface(resource),
    dtoMapperIdCodecField: '',
    dtoMapperWriteMethods: dtoMapperWriteMethods(resource),
    dtoMapperSummaryMappings: '',
    dtoMapperDetailMappings: '',
    dtoMapperUses: dtoMapperUses(embedChildren),
    dtoMapperChildImportBlock: '',
    dtoMapperChildMethods: dtoMapperChildMethods(resource, embedChildren),
    entityMapperExtraImportBlock: entityMapperExtraImportBlock(embedChildren),
    entityMapperUses: entityMapperUses(embedChildren),
    entityMapperChildMethods: entityMapperChildMethods(resource, embedChildren),
    migration: buildMigrationContext(resource, options, fields),
    packages
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
  if (resource.parent?.route === 'nested') {
    return [
      resource.parent.endpoint.replace(/^\/+|\/+$/g, ''),
      `{${resource.parent.pathParam}}`,
      resource.endpoint.replace(/^\/+/, '')
    ].join('/');
  }
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

function controllerHookRequestImportBlock(resource) {
  if (resource.mode === 'read') return '';
  return [
    `import ${resource.packageName}.application.dto.${resource.name}CreateRequest;`,
    `import ${resource.packageName}.application.dto.${resource.name}UpdateRequest;`
  ].join('\n');
}

function controllerHookGenericTypes(resource) {
  if (resource.mode === 'read') {
    return `Object, Object, ${resource.name}SummaryResponse, ${resource.name}DetailResponse`;
  }
  return `${resource.name}CreateRequest, ${resource.name}UpdateRequest, ${resource.name}SummaryResponse, ${resource.name}DetailResponse`;
}

function buildControllerImports(resource, projectionFields) {
  const imports = new Set();
  if (projectionFields.length > 0 || resource.lookup) imports.add('java.util.List');
  if (resource.lookup) {
    imports.add('java.util.Collections');
    imports.add('org.springframework.security.access.prepost.PreAuthorize');
    imports.add('org.springframework.web.bind.annotation.PostMapping');
    imports.add('org.springframework.web.bind.annotation.RequestBody');
    imports.add('gasi.one.core.api.common.dto.ApiResponse');
    imports.add('gasi.one.core.api.common.dto.PageResult');
    imports.add('gasi.one.core.api.common.query.QueryRequest');
    imports.add('gasi.one.core.starter.presentation.support.ResponseProjection');
  }
  return [...imports].sort();
}

function controllerHookMutationMethods(resource, nestedParent) {
  if (resource.mode === 'read' || !nestedParent) return '';
  return `

    @Override
    public void beforeCreateRequest(${resource.name}CreateRequest request, ResourceRequestContext context) {
        if (request == null) {
            return;
        }
        Long parentId = decodeParentId(context);
        if (parentId != null) {
            request.set${nestedParent.requestAccessor}(parentId);
        }
    }

    @Override
    public void beforeUpdateRequest(String id, ${resource.name}UpdateRequest request,
            ResourceRequestContext context) {
        if (request == null) {
            return;
        }
        Long parentId = decodeParentId(context);
        if (parentId != null) {
            request.set${nestedParent.requestAccessor}(parentId);
        }
    }`;
}

function controllerClassExtends(resource) {
  if (resource.mode === 'read') {
    return ` extends\n        BaseReadController<${resource.name}SummaryResponse, ${resource.name}DetailResponse>`;
  }
  return ` extends\n        BaseController<${resource.name}, ${resource.name}CreateRequest, ${resource.name}UpdateRequest, ${resource.name}SummaryResponse, ${resource.name}DetailResponse>`;
}

function controllerBody(resource, projectionFields) {
  const ctor = resource.mode === 'read'
    ? `    public ${resource.name}Controller(${resource.name}Service service, IdCodec idCodec,
            ResourceControllerHookRegistry hookRegistry) {
        super(service, idCodec, hookRegistry);
    }`
    : `    public ${resource.name}Controller(${resource.name}Service service, IdCodec idCodec,
            ResourceControllerHookRegistry hookRegistry) {
        super(service, idCodec, hookRegistry);
    }`;

  const projectionOverride = projectionFields.length === 0
    ? ''
    : `

    @Override
    protected List<String> getDefaultProjectionFields() {
        return List.of("id", ${projectionFields.map((field) => `"${field.responseName}"`).join(', ')});
    }`;

  const lookupMethod = resource.lookup
    ? `

    @PostMapping("/lookup/query/page")
    @PreAuthorize("hasPermission(this, 'LOOKUP')")
    public ApiResponse<PageResult<?>> lookupPaged(@RequestBody QueryRequest request) {
        PageResult<${resource.name}SummaryResponse> result = getService().findAll(
                request.normalizedPage(),
                request.normalizedSize(),
                request.getFilter(),
                request.getSorts() != null ? request.getSorts() : Collections.emptyList());
        List<String> fields = request.getFields() == null || request.getFields().isEmpty()
                ? getDefaultProjectionFields()
                : request.getFields();
        return ApiResponse.ok(ResponseProjection.projectPage(result, fields));
    }`
    : '';

  return `${ctor}

    @Override
    public String resourceType() {
        return "${resource.name}";
    }${projectionOverride}${lookupMethod}`;
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
    annotations.push(`@Enumerated(EnumType.${field.enum.persistenceType.toUpperCase()})`);
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
  const required = field.required && !field.nestedParentRelation;

  if (required && stringLike) annotations.push('@NotBlank');
  if (required && !stringLike) annotations.push('@NotNull');
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

function isNestedParentRelation(resource, field) {
  return resource.parent?.route === 'nested'
    && field.relation?.type === 'many-to-one'
    && field.relation.target === resource.parent.resource;
}

function isEmbeddedParentRelation(resource, field) {
  return resource.mode === 'embed'
    && field.relation?.type === 'many-to-one'
    && field.relation.target === resource.parent?.resource;
}

function nestedParentContext(resource, fields) {
  if (resource.parent?.route !== 'nested') return null;
  const field = fields.find((candidate) => candidate.nestedParentRelation);
  if (!field) return null;
  return {
    resource: resource.parent.resource,
    pathParam: resource.parent.pathParam,
    fieldName: field.propertyName,
    fieldAccessor: field.javaAccessor,
    filterField: `${field.propertyName}.id`,
    requestFieldName: field.requestName,
    requestAccessor: field.requestAccessor,
    parentModelType: field.relation.target,
    parentModelPackage: `${field.relation.packageName}.domain.model.${field.relation.target}`
  };
}

function serviceRelationHookContext(resource, fields, nestedParent) {
  if (resource.mode !== 'crud') return null;
  const relations = fields.filter((field) => field.relation?.type === 'many-to-one' && !field.embeddedParentRelation);
  if (relations.length === 0) return null;

  const imports = new Set([
    'org.springframework.stereotype.Component',
    'gasi.one.core.api.common.exception.EntityNotFoundException',
    'gasi.one.core.api.resource.hook.HookLayer',
    'gasi.one.core.api.resource.hook.ResourceHook',
    'gasi.one.core.api.resource.hook.ResourceServiceHook',
    `${resource.packageName}.application.dto.${resource.name}CreateRequest`,
    `${resource.packageName}.application.dto.${resource.name}DetailResponse`,
    `${resource.packageName}.application.dto.${resource.name}SummaryResponse`,
    `${resource.packageName}.application.dto.${resource.name}UpdateRequest`,
    `${resource.packageName}.domain.model.${resource.name}`
  ]);
  if (nestedParent) {
    imports.add('gasi.one.core.api.common.id.IdCodec');
    imports.add('gasi.one.core.api.resource.hook.ResourceRequestContext');
    imports.add('gasi.one.core.api.resource.hook.ResourceRequestContextHolder');
    imports.add(`${resource.packageName}.domain.port.outbound.${resource.name}RepositoryPort`);
  }

  const entries = relations.map((field) => {
    const target = field.relation.target;
    const variableName = field.propertyName;
    const accessor = field.javaAccessor;
    const repositoryField = `${variableName}RepositoryPort`;
    imports.add(`${field.relation.packageName}.domain.model.${target}`);
    imports.add(`${field.relation.packageName}.domain.port.outbound.${target}RepositoryPort`);
    return {
      target,
      variableName,
      accessor,
      repositoryField,
      constructorParam: `${target}RepositoryPort ${repositoryField}`,
      assignment: `        this.${repositoryField} = ${repositoryField};`,
      fieldDeclaration: `    private final ${target}RepositoryPort ${repositoryField};`,
      validateBlock: `        if (domain.get${accessor}() != null && domain.get${accessor}().getId() != null) {
            ${target} ${variableName} = ${repositoryField}.findById(domain.get${accessor}().getId())
                    .orElseThrow(() -> new EntityNotFoundException("${target} not found: " + domain.get${accessor}().getId()));
            domain.set${accessor}(${variableName});
        }`
    };
  });

  const constructorEntries = [...entries];
  if (nestedParent) {
    constructorEntries.unshift({
      fieldDeclaration: '    private final IdCodec idCodec;',
      constructorParam: 'IdCodec idCodec',
      assignment: '        this.idCodec = idCodec;'
    }, {
      fieldDeclaration: `    private final ${resource.name}RepositoryPort repositoryPort;`,
      constructorParam: `${resource.name}RepositoryPort repositoryPort`,
      assignment: '        this.repositoryPort = repositoryPort;'
    });
  }

  return {
    importBlock: importBlock([...imports].sort()),
    genericTypes: `${resource.name}, ${resource.name}CreateRequest, ${resource.name}UpdateRequest, ${resource.name}SummaryResponse, ${resource.name}DetailResponse`,
    fieldDeclarations: constructorEntries.map((entry) => entry.fieldDeclaration).join('\n'),
    constructorParams: constructorEntries.map((entry) => entry.constructorParam).join(',\n            '),
    constructorAssignments: constructorEntries.map((entry) => entry.assignment).join('\n'),
    validateBlocks: entries.map((entry) => entry.validateBlock).join('\n'),
    ownershipMethods: nestedParentOwnershipMethods(resource, nestedParent)
  };
}

function nestedParentOwnershipMethods(resource, nestedParent) {
  if (!nestedParent) return '';
  return `

    @Override
    public void beforeFindById(String resourceType, Long id) {
        validateParentOwnership(id);
    }

    @Override
    public void beforeUpdateRequest(String resourceType, Long id, ${resource.name}UpdateRequest request) {
        validateParentOwnership(id);
    }

    @Override
    public void beforeDeleteRequest(String resourceType, Long id) {
        validateParentOwnership(id);
    }

    private void validateParentOwnership(Long id) {
        ResourceRequestContext context = ResourceRequestContextHolder.get();
        String encodedParentId = context.pathVariable("${nestedParent.pathParam}");
        Long parentId = idCodec.decode(encodedParentId);
        if (parentId == null) {
            return;
        }

        ${resource.name} domain = repositoryPort.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("${resource.name} not found: " + id));
        if (domain.get${nestedParent.fieldAccessor}() == null
                || !parentId.equals(domain.get${nestedParent.fieldAccessor}().getId())) {
            throw new EntityNotFoundException("${resource.name} not found: " + id);
        }
    }`;
}

function buildEmbedChildren(children) {
  return children.map((child) => {
    const parentRelation = child.fields.find((field) =>
      field.relation?.type === 'many-to-one' && field.relation.target === child.parent?.resource
    );
    const fieldName = child.parent?.field || child.variableName;
    const accessor = accessorName(fieldName);

    return {
      name: child.name,
      fieldName,
      accessor,
      relationFieldName: parentRelation?.propertyName,
      relationAccessor: accessorName(parentRelation?.propertyName ?? ''),
      packages: {
        model: `${child.packageName}.domain.model`,
        dto: `${child.packageName}.application.dto`,
        dtoMapper: `${child.packageName}.application.mapper`,
        entity: `${child.packageName}.infrastructure.entity`,
        entityMapper: `${child.packageName}.infrastructure.mapper`
      },
      modelField: {
        propertyName: fieldName,
        entityJavaType: `List<${child.name}>`,
        relation: null,
        embed: true
      },
      entityField: {
        propertyName: fieldName,
        entityJavaType: `List<${child.name}Entity>`,
        relation: null,
        embed: true,
        entityAnnotationBlock: `    @OneToMany(mappedBy = "${parentRelation?.propertyName}", cascade = CascadeType.ALL, orphanRemoval = true)`
      },
      createField: {
        requestName: fieldName,
        requestJavaType: `List<${child.name}CreateRequest>`,
        requestAnnotationBlock: ''
      },
      updateField: {
        requestName: fieldName,
        requestJavaType: `List<${child.name}UpdateRequest>`,
        requestAnnotationBlock: ''
      },
      detailField: {
        responseName: fieldName,
        responseJavaType: `List<${child.name}DetailResponse>`
      }
    };
  });
}

function buildEntityImports(fields, targetPackage, embedChildren = []) {
  const imports = new Set(['jakarta.persistence.Column']);

  for (const field of fields) {
    if (field.javaType === 'BigDecimal') imports.add('java.math.BigDecimal');
    if (field.javaType === 'LocalDate') imports.add('java.time.LocalDate');
    if (field.javaType === 'LocalDateTime') imports.add('java.time.LocalDateTime');
    if (field.javaType === 'Instant') imports.add('java.time.Instant');
    if (field.javaType === 'UUID') imports.add('java.util.UUID');
    if (field.type === 'enum') imports.add('jakarta.persistence.EnumType');
    if (field.type === 'enum') imports.add('jakarta.persistence.Enumerated');
    addEnumImport(imports, field, targetPackage);
    if (field.relation) {
      imports.add('jakarta.persistence.FetchType');
      imports.add('jakarta.persistence.JoinColumn');
      imports.add('jakarta.persistence.ManyToOne');
      imports.add(`${field.relation.packageName}.infrastructure.entity.${field.relation.target}Entity`);
    }
  }
  for (const child of embedChildren) {
    imports.add('java.util.List');
    imports.add('jakarta.persistence.CascadeType');
    imports.add('jakarta.persistence.OneToMany');
    imports.add(`${child.packages.entity}.${child.name}Entity`);
  }

  return [...imports].sort();
}

function buildModelImports(fields, targetPackage, embedChildren = []) {
  const imports = new Set();

  for (const field of fields) {
    if (field.javaType === 'BigDecimal') imports.add('java.math.BigDecimal');
    if (field.javaType === 'LocalDate') imports.add('java.time.LocalDate');
    if (field.javaType === 'LocalDateTime') imports.add('java.time.LocalDateTime');
    if (field.javaType === 'Instant') imports.add('java.time.Instant');
    if (field.javaType === 'UUID') imports.add('java.util.UUID');
    addEnumImport(imports, field, targetPackage);
    if (field.relation) imports.add(`${field.relation.packageName}.domain.model.${field.relation.target}`);
  }
  for (const child of embedChildren) {
    imports.add('java.util.List');
    imports.add(`${child.packages.model}.${child.name}`);
  }

  return [...imports].sort();
}

function buildRequestDtoImports(fields, targetPackage, embedChildren = [], kind = 'create') {
  const imports = new Set();

  for (const field of fields) {
    if (field.requestJavaType === 'BigDecimal') imports.add('java.math.BigDecimal');
    if (field.requestJavaType === 'LocalDate') imports.add('java.time.LocalDate');
    if (field.requestJavaType === 'LocalDateTime') imports.add('java.time.LocalDateTime');
    if (field.requestJavaType === 'Instant') imports.add('java.time.Instant');
    if (field.requestJavaType === 'UUID') imports.add('java.util.UUID');
    addEnumImport(imports, field, targetPackage);
    for (const annotation of field.requestAnnotations) {
      const name = annotation.match(/^@([A-Za-z]+)/)?.[1];
      if (name) imports.add(`jakarta.validation.constraints.${name}`);
    }
  }
  for (const child of embedChildren) {
    imports.add('java.util.List');
    imports.add(`${child.packages.dto}.${child.name}${kind === 'update' ? 'Update' : 'Create'}Request`);
  }

  return [...imports].sort();
}

function buildResponseDtoImports(fields, targetPackage, embedChildren = []) {
  const imports = new Set();

  for (const field of fields) {
    if (field.responseJavaType === 'BigDecimal') imports.add('java.math.BigDecimal');
    if (field.responseJavaType === 'LocalDate') imports.add('java.time.LocalDate');
    if (field.responseJavaType === 'LocalDateTime') imports.add('java.time.LocalDateTime');
    if (field.responseJavaType === 'Instant') imports.add('java.time.Instant');
    if (field.responseJavaType === 'UUID') imports.add('java.util.UUID');
    addEnumImport(imports, field, targetPackage);
  }
  for (const child of embedChildren) {
    imports.add('java.util.List');
    imports.add(`${child.packages.dto}.${child.name}DetailResponse`);
  }

  return [...imports].sort();
}

function dtoMapperExtraImportBlock(embedChildren) {
  const imports = [];
  if (embedChildren.length > 0) imports.push('org.mapstruct.AfterMapping');
  for (const child of embedChildren) {
    imports.push(`${child.packages.dtoMapper}.${child.name}DtoMapper`);
  }
  return importBlock(imports.sort());
}

function dtoMapperUses(embedChildren) {
  return embedChildren.length === 0
    ? ''
    : `, ${embedChildren.map((child) => `${child.name}DtoMapper.class`).join(', ')}`;
}

function dtoMapperChildMethods(resource, embedChildren) {
  if (resource.mode === 'read') return '';
  const blocks = embedChildren
    .filter((child) => child.relationFieldName)
    .map((child) => `        if (domain.get${child.accessor}() != null) {
            domain.get${child.accessor}().forEach(child -> child.set${child.relationAccessor}(domain));
        }`);
  if (blocks.length === 0) return '';

  return `

    @AfterMapping
    protected void attachEmbedChildren(@MappingTarget ${resource.name} domain) {
${blocks.join('\n')}
    }`;
}

function entityMapperExtraImportBlock(embedChildren) {
  const imports = [];
  if (embedChildren.length > 0) imports.push('org.mapstruct.AfterMapping');
  for (const child of embedChildren) {
    imports.push(`${child.packages.entityMapper}.${child.name}Mapper`);
  }
  return importBlock(imports.sort());
}

function entityMapperUses(embedChildren) {
  return embedChildren.length === 0
    ? ''
    : `(uses = { ${embedChildren.map((child) => `${child.name}Mapper.class`).join(', ')} })`;
}

function entityMapperChildMethods(resource, embedChildren) {
  const blocks = embedChildren
    .filter((child) => child.relationFieldName)
    .map((child) => `        if (entity.get${child.accessor}() != null) {
            entity.get${child.accessor}().forEach(child -> child.set${child.relationAccessor}(entity));
        }`);
  if (blocks.length === 0) return '';

  return `

    @AfterMapping
    default void attachEmbedChildren(@org.mapstruct.MappingTarget ${resource.name}Entity entity) {
${blocks.join('\n')}
    }`;
}

function addEnumImport(imports, field, targetPackage) {
  if (field.type !== 'enum' || !field.enum?.packageName || field.enum.packageName === targetPackage) return;
  imports.add(`${field.enum.packageName}.${field.enum.name}`);
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
