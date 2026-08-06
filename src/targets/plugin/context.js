export function pluginContext(plugin) {
  return {
    BASE_PACKAGE: 'gasi.one',
    FULL_PACKAGE: plugin.packageName,
    PLUGIN_ID: plugin.code,
    PLUGIN_PREFIX: plugin.code,
    PLUGIN_CLASS_NAME: `${plugin.className}Plugin`,
    EXTENSION_CLASS_NAME: plugin.extensionClassName,
    FLYWAY_EXT_CLASS_NAME: plugin.flywayExtensionClassName,
    I18N_EXT_CLASS_NAME: plugin.i18nExtensionClassName,
    PLUGIN_VERSION: plugin.version,
    PLUGIN_DESCRIPTION: plugin.description,
    PLUGIN_DEPENDENCIES: plugin.dependencies,
    FLYWAY_LOCATION: `db/migration/${plugin.code}`,
    I18N_BASENAME: `i18n/${plugin.code}/messages`,
    I18N_CUSTOM_BASENAME: `i18n/${plugin.code}/custom/messages`,
    PLUGIN_NAME: plugin.name,
    PLUGIN_CODE: plugin.code,
    ARTIFACT_ID: plugin.artifactId,
    CLASS_NAME: plugin.className,
    VARIABLE_NAME: plugin.variableName,
    VERSION: plugin.version,
    DESCRIPTION: plugin.description,
    DISPLAY_NAME: plugin.displayName,
    API_PACKAGE: plugin.packageName,
    API_PLUGIN_PREFIX: plugin.code,
    API_DEPENDENCIES: plugin.dependencies
  };
}
