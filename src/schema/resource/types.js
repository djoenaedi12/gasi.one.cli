export const fieldTypes = {
  string: {
    javaType: 'String',
    tsType: 'string',
    inputType: 'text'
  },
  text: {
    javaType: 'String',
    tsType: 'string',
    inputType: 'textarea'
  },
  integer: {
    javaType: 'Integer',
    tsType: 'number',
    inputType: 'number'
  },
  long: {
    javaType: 'Long',
    tsType: 'number',
    inputType: 'number'
  },
  decimal: {
    javaType: 'BigDecimal',
    tsType: 'number',
    inputType: 'number'
  },
  double: {
    javaType: 'Double',
    tsType: 'number',
    inputType: 'number'
  },
  boolean: {
    javaType: 'Boolean',
    tsType: 'boolean',
    inputType: 'checkbox'
  },
  date: {
    javaType: 'LocalDate',
    tsType: 'string',
    inputType: 'date'
  },
  datetime: {
    javaType: 'LocalDateTime',
    tsType: 'string',
    inputType: 'datetime-local'
  },
  instant: {
    javaType: 'Instant',
    tsType: 'string',
    inputType: 'datetime-local'
  },
  uuid: {
    javaType: 'UUID',
    tsType: 'string',
    inputType: 'text'
  },
  enum: {
    javaType: null,
    tsType: 'string',
    inputType: 'select'
  }
};
