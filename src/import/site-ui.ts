// Runs the "words and photos" step from a screen and says, in plain words, what happened.
import {get, patch, post} from '../api';
import {h} from '../ui';
import type {Manifest} from './types';
import {runSiteStep, siteStepState, type SiteStepResult, type SiteText} from './site';

const api = {get, post: <T>(p: string, b?: unknown, v?: number) => post<T>(p, b, v), patch};

/** True when the step has not run and there is no site profile yet. */
export const siteStepPending = async (): Promise<boolean> => (await siteStepState(api)) === 'todo';

export function describeSiteResult(r: SiteStepResult): Node[] {
  if (!r.ran) return [h('p', null, 'Your site words and photos were already set up.')];
  const out: Node[] = [
    h(
      'p',
      null,
      `Your site's words are in, with photos in ${r.placesSet} places` +
        (r.published ? ` (${r.published} photo${r.published === 1 ? '' : 's'} made public).` : '.'),
    ),
  ];
  if (r.timezoneChanged) out.push(h('p', {class: 'muted'}, 'Your time zone is now Pacific.'));
  if (r.failed.length)
    out.push(
      h('p', null, 'These photos could not be made public (choose them again on the Site screen):'),
      h(
        'ul',
        {class: 'problems', role: 'alert'},
        r.failed.map(f => h('li', null, `${f.title}: ${f.message}`)),
      ),
    );
  return out;
}

/** Runs the step into `box`. Resolves when finished; errors are shown, not thrown. */
export async function runSiteImportInto(box: HTMLElement): Promise<SiteStepResult | null> {
  const line = h('p', {class: 'now', 'aria-live': 'polite'}, 'Setting up your site words and photos…');
  box.replaceChildren(line);
  try {
    const [m, t] = await Promise.all([import('./manifest.json'), import('./site-text.json')]);
    const result = await runSiteStep({
      api,
      manifest: m.default as unknown as Manifest,
      text: t.default as unknown as SiteText,
      onProgress: msg => (line.textContent = msg),
    });
    box.replaceChildren(
      ...describeSiteResult(result),
      h('p', null, h('a', {href: '/studio/site'}, 'Open the Site screen')),
    );
    return result;
  } catch {
    box.replaceChildren(
      h(
        'p',
        {class: 'err', role: 'alert'},
        'The site words and photos could not be set up. Open the Site screen to try again.',
      ),
    );
    return null;
  }
}
