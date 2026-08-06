export function parseOptions(args, definitions = {}) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const definition = definitions[arg];

    if (!definition) {
      throw new Error(`Unknown option: ${arg}`);
    }

    const key = definition.key;
    if (definition.type === 'boolean') {
      options[key] = true;
    } else {
      const value = args[++index];
      if (!value || value.startsWith('-')) {
        throw new Error(`Missing value for option: ${arg}`);
      }
      options[key] = value;
    }
  }

  return options;
}

export function requireOption(options, key, label) {
  if (!options[key]) {
    throw new Error(`Missing required option: ${label}`);
  }
}
