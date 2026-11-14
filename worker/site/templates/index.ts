// The site's templates (D-180). Plaster is the default; `pick` falls back to it for anything it doesn't know.
import {gallery} from './gallery';
import {plaster} from './plaster';
import type {Template} from './template';

export type {Template, TemplateOptions} from './template';

export const TEMPLATES: readonly Template[] = [plaster, gallery];
export const DEFAULT_TEMPLATE = plaster;

export const known = (id: string | null | undefined): Template | undefined =>
  id ? TEMPLATES.find(t => t.id === id) : undefined;

export const pick = (id: string | null | undefined): Template => known(id) ?? DEFAULT_TEMPLATE;
