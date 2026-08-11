export function buildResourceWebContext(resource) {
  const requestFields = resource.fields.map(webField);
  const responseFields = resource.fields.flatMap((field) => {
    const nextField = webField(field);
    if (!field.relation?.labelField) return [nextField];
    return [nextField, relationLabelField(field)];
  });
  const displayFields = responseFields.filter((field) => !field.relationId);

  return {
    resource,
    fields: responseFields,
    requestFields,
    responseFields,
    displayFields
  };
}

function webField(field) {
  return {
    ...field,
    typeName: field.relation ? `${field.name}Id` : field.name,
    requestName: field.relation ? `${field.name}Id` : field.name,
    relationId: Boolean(field.relation),
    tsType: field.relation ? 'string' : field.tsType,
    inputType: field.relation ? 'text' : field.inputType
  };
}

function relationLabelField(field) {
  return {
    ...field,
    name: `${field.name}Label`,
    typeName: `${field.name}Label`,
    requestName: `${field.name}Label`,
    label: field.label,
    relation: null,
    relationLabel: true,
    tsType: 'string'
  };
}
