import { camelCase, kebabCase, packageToPath, pascalCase, titleCase } from '../../core/naming.js';

export function normalizePluginDocument(rawDocument) {
  if (!rawDocument || typeof rawDocument !== 'object' || Array.isArray(rawDocument)) {
    throw new Error('Plugin schema must be a JSON object.');
  }

  const name = kebabCase(rawDocument.name ?? '');
  const code = kebabCase(rawDocument.code ?? name);
  const packageName = `gasi.one.plugins.${camelCase(code)}`;
  const displayName = rawDocument.displayName ?? titleCase(name);
  const dependsOn = rawDocument.dependsOn ?? [];

  return {
    name,
    code,
    className: pascalCase(name),
    extensionClassName: `${pascalCase(name)}Extension`,
    flywayExtensionClassName: `${pascalCase(name)}FlywayExtension`,
    i18nExtensionClassName: `${pascalCase(name)}I18nExtension`,
    variableName: camelCase(name),
    artifactId: `${name}-plugin`,
    pluginPath: `${name}-plugin`,
    version: rawDocument.version ?? '1.0.0',
    description: rawDocument.description ?? `${displayName} plugin`,
    displayName,
    packageName,
    packagePath: packageToPath(packageName),
    dependsOn,
    dependencies: dependsOn.join(',')
  };
}
