import { pluginContext } from './context.js';

export function createPluginApiFiles(plugin) {
  const context = pluginContext(plugin);
  const basePath = plugin.pluginPath;
  const javaPath = `${basePath}/src/main/java/${plugin.packagePath}`;
  const extensionPath = `${javaPath}/extension`;
  return [
    file(`${basePath}/src/main/resources/META-INF/NOTICE`, 'legal/NOTICE.hbs', {}),
    file(`${basePath}/pom.xml`, 'plugin/api/pom.xml.hbs', context),
    file(`${javaPath}/${plugin.className}Plugin.java`, 'plugin/api/plugin.java.hbs', context),
    file(`${extensionPath}/${plugin.extensionClassName}.java`, 'plugin/api/app-extension.java.hbs', context),
    file(`${extensionPath}/${plugin.flywayExtensionClassName}.java`, 'plugin/api/flyway-extension.java.hbs', context),
    file(`${extensionPath}/${plugin.i18nExtensionClassName}.java`, 'plugin/api/i18n-extension.java.hbs', context),
    file(`${basePath}/src/main/resources/plugin.properties`, 'plugin/api/plugin.properties.hbs', context)
  ];
}

function file(path, template, context) {
  return { target: 'api', path, template, context };
}
