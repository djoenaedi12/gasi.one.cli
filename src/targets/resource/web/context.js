export function buildResourceWebContext(resource) {
  return {
    resource,
    fields: resource.fields.map((field) => ({
      ...field,
      typeName: field.relation ? `${field.name}Id` : field.name,
      requestName: field.relation ? `${field.name}Id` : field.name
    }))
  };
}
