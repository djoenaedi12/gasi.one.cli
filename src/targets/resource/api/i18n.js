import { titleCase } from '../../../core/naming.js';

export function buildI18nFiles(resources, existingLocalesByPlugin = new Map()) {
  const grouped = new Map();
  const localesByPlugin = pluginLocales(resources, existingLocalesByPlugin);
  const pluginNames = [...localesByPlugin.keys()];

  for (const pluginName of pluginNames) {
    grouped.set(`${pluginName}:default`, {
      pluginName,
      locale: 'default',
      fileName: 'messages.properties',
      lines: []
    });
  }

  for (const resource of resources) {
    const pluginName = resolvePluginName(resource);
    const locales = localesByPlugin.get(pluginName) ?? ['en'];
    grouped.get(`${pluginName}:default`).lines.push(...resourceMessages(pluginName, resource, defaultLocale(resource)));

    for (const locale of locales) {
      const key = `${pluginName}:${locale}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          pluginName,
          locale,
          fileName: `messages_${locale}.properties`,
          lines: []
        });
      }

      grouped.get(key).lines.push(...resourceMessages(pluginName, resource, locale));
    }
  }

  return [...grouped.values()].map((file) => ({
    ...file,
    content: file.lines.join('\n')
  }));
}

function pluginLocales(resources, existingLocalesByPlugin) {
  const grouped = new Map([...existingLocalesByPlugin.entries()].map(([pluginName, locales]) => [pluginName, new Set(locales)]));

  for (const resource of resources) {
    const pluginName = resolvePluginName(resource);
    if (!grouped.has(pluginName)) grouped.set(pluginName, new Set());
    for (const locale of Object.keys(resource.i18n ?? {})) {
      grouped.get(pluginName).add(locale);
    }
  }

  for (const locales of grouped.values()) {
    if (locales.size === 0) locales.add('en');
  }

  return new Map([...grouped.entries()].map(([pluginName, locales]) => [pluginName, [...locales].sort()]));
}

function defaultLocale(resource) {
  if (resource.i18n?.en) return 'en';
  return null;
}

function resourceMessages(pluginName, resource, locale) {
  const localeMessages = locale ? resource.i18n?.[locale] ?? {} : {};
  const resourceKey = resource.variableName;
  const prefix = `${pluginName}.${resourceKey}`;
  const lines = [
    `${prefix}.label=${propertyValue(localeMessages.label ?? resource.title)}`,
    `${prefix}.labelPlural=${propertyValue(localeMessages.labelPlural ?? pluralLabel(resource))}`
  ];

  const fieldMessages = localeMessages.field ?? {};
  for (const field of resource.fields) {
    lines.push(`${prefix}.field.${field.name}=${propertyValue(fieldMessages[field.name] ?? field.label)}`);
  }

  const validationMessages = localeMessages.validation ?? {};
  for (const [fieldName, rules] of Object.entries(validationMessages)) {
    for (const [ruleName, message] of Object.entries(rules)) {
      lines.push(`${prefix}.validation.${fieldName}.${ruleName}=${propertyValue(message)}`);
    }
  }

  return lines;
}

function resolvePluginName(resource) {
  if (resource.pluginName) return resource.pluginName;
  const parts = resource.packageName.split('.');
  const oneIndex = parts.findIndex((part, index) => part === 'one' && parts[index - 1] === 'gasi');
  return parts[oneIndex + 1] ?? parts.at(-2) ?? 'app';
}

function pluralLabel(resource) {
  return titleCase(resource.routePath);
}

function propertyValue(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/([:=#!])/g, '\\$1');
}
