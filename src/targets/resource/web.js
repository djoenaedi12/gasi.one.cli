import { featurePathFromPackage } from '../../core/naming.js';
import { buildResourceWebContext } from './web/context.js';

export function createResourceWebFiles(resource) {
  const context = buildResourceWebContext(resource);
  const basePath = `web/src/features/${featurePathFromPackage(resource.packageName)}`;
  const className = resource.name;

  return [
    file(`${basePath}/${className}Types.ts`, 'resource/web/types.ts.hbs', context),
    file(`${basePath}/${className}Api.ts`, 'resource/web/api.ts.hbs', context),
    file(`${basePath}/${className}List.tsx`, 'resource/web/list.tsx.hbs', context),
    file(`${basePath}/${className}Form.tsx`, 'resource/web/form.tsx.hbs', context),
    file(`${basePath}/${className}Detail.tsx`, 'resource/web/detail.tsx.hbs', context)
  ];
}

function file(path, template, context) {
  return { target: 'web', path, template, context };
}
