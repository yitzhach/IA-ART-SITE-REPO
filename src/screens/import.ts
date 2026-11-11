import './import.css';
import {get, patch, post} from '../api';
import {prepareImage} from '../lib/images';
import {attachToArtwork, uploadPrepared} from '../lib/upload';
import {h} from '../ui';
import type {Params} from '../router';
import type {Drafts, Manifest} from '../import/types';
import {keysToRecord, listEveryWork, plan, runImport, type ImportProgress, type ImportResult} from '../import/run';

const api = {get, post: <T>(p: string, b?: unknown) => post<T>(p, b), patch};

async function fetchImage(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`The old site's picture could not be fetched (${res.status}).`);
  const blob = await res.blob();
  // raw.githubusercontent serves these as the right type, but be sure: the upload checks it
  return /\.webp$/i.test(url) && blob.type !== 'image/webp' ? new Blob([blob], {type: 'image/webp'}) : blob;
}

async function draft(artworkId: string, prepared?: Drafts[string]): Promise<'started' | 'unavailable' | 'failed'> {
  try {
    const res = await fetch('/assistant/draft', {
      method: 'POST',
      credentials: 'include',
      headers: {'content-type': 'application/json', accept: 'application/json'},
      body: JSON.stringify(prepared ? {artworkId, prepared} : {artworkId}),
    });
    if (res.status === 503) return 'unavailable';
    return res.ok ? 'started' : 'failed';
  } catch {
    return 'failed';
  }
}

interface Settings {
  version: number;
  meta?: Record<string, unknown> & {siteImport?: {keys?: string[]}};
}
const recordedKeys = (s: Settings) => new Set(s.meta?.siteImport?.keys ?? []);

/** Remember what came in, so a photo deleted later is never brought back. */
async function record(manifest: Manifest): Promise<void> {
  try {
    const s = await get<Settings>('/settings');
    const keys = keysToRecord(await listEveryWork(api), recordedKeys(s));
    await patch('/settings', {meta: {...s.meta, siteImport: {sha: manifest.sha, keys}}}, s.version);
  } catch {
    // Not fatal: the next run checks again.
  }
}

const photos = (n: number) => `${n} photo${n === 1 ? '' : 's'}`;

export async function render(el: HTMLElement, _params: Params): Promise<void> {
  el.replaceChildren(
    h('section', {class: 'import'}, h('h1', null, 'Bring in your old photos'), h('p', null, 'Looking…')),
  );
  const root = el.firstElementChild as HTMLElement;

  let manifest: Manifest, drafts: Drafts, pending: ReturnType<typeof plan>, settings: Settings;
  try {
    // the list of photos is big, so it is only loaded on this screen
    const [m, d] = await Promise.all([import('../import/manifest.json'), import('../import/drafts.json')]);
    manifest = m.default as unknown as Manifest;
    drafts = d.default as unknown as Drafts;
    settings = await get<Settings>('/settings');
    pending = plan(manifest, await listEveryWork(api), recordedKeys(settings));
  } catch (e) {
    root.replaceChildren(
      h('h1', null, 'Bring in your old photos'),
      h('p', {class: 'err', role: 'alert'}, 'Could not check what is already in. Reload and try again.'),
    );
    return;
  }

  const total = manifest.works.length;
  const left = pending.todo.length;
  const status = h('div', {'aria-live': 'polite'});
  const start = h('button', {class: 'primary', type: 'button'}, `Import ${photos(left)}`);
  const stop = h('button', {type: 'button', hidden: true}, 'Stop');
  let controller: AbortController | null = null;

  const intro = [
    h('h1', null, 'Bring in your old photos'),
    h(
      'p',
      {class: 'lede'},
      'Every photograph from your current website comes in as a draft. Nothing is made public: you approve each work, and delete the photos you don’t want.',
    ),
    h(
      'p',
      {class: 'counts'},
      `${total} photos on your current site, ${pending.alreadyThere} already in` +
        (pending.removed ? `, ${pending.removed} you deleted (they stay out)` : '') +
        '.',
    ),
  ];

  if (left === 0) {
    root.replaceChildren(
      ...intro,
      h('p', null, 'Everything is already in. ', h('a', {href: '/studio/review'}, 'Next: review them')),
    );
    return;
  }
  root.replaceChildren(...intro, h('div', {class: 'row'}, start, stop), status);

  const showProgress = (p: ImportProgress) =>
    status.replaceChildren(
      h('p', {class: 'now'}, `Importing ${p.index} of ${p.total} — ${p.title}`),
      h('progress', {max: p.total, value: p.index - 1}),
    );

  const showResult = (r: ImportResult) => {
    const added = r.created + r.repaired;
    const parts: (Node | string)[] = [];
    if (r.stopped) parts.push(`Stopped. ${photos(added)} added so far. Tap Import again to carry on where it stopped.`);
    else if (r.failed.length) parts.push(`${added} drafts added, ${r.failed.length} could not be added.`);
    else parts.push(`${added} drafts added. `, h('a', {href: '/studio/review'}, 'Next: review them'));
    status.replaceChildren(h('p', null, ...parts));
    if (r.failed.length) {
      status.append(
        h('p', null, 'These need another try (tap Import again, the rest are done):'),
        h(
          'ul',
          {class: 'problems', role: 'alert'},
          r.failed.map(f => h('li', null, `${f.title}: ${f.message}`)),
        ),
      );
      if (!r.stopped) status.append(h('p', null, h('a', {href: '/studio/review'}, 'Review the ones that are in')));
    }
  };

  start.addEventListener('click', async () => {
    controller = new AbortController();
    start.disabled = true;
    stop.hidden = false;
    stop.disabled = false;
    try {
      const result = await runImport({
        manifest,
        drafts,
        api,
        prepare: prepareImage,
        upload: p => uploadPrepared(p),
        attach: attachToArtwork,
        fetchImage,
        draft,
        onProgress: showProgress,
        signal: controller.signal,
      });
      showResult(result);
      await record(manifest);
      start.textContent = 'Import again';
      start.hidden = !result.failed.length && !result.stopped;
    } catch (e) {
      status.replaceChildren(
        h(
          'p',
          {class: 'err', role: 'alert'},
          'The import could not start. Check your connection and tap Import again.',
        ),
      );
    } finally {
      start.disabled = false;
      stop.hidden = true;
      controller = null;
    }
  });
  // Opened by the studio's first visit (works screen): start without a tap.
  if (new URLSearchParams(location.search).has('auto')) {
    status.replaceChildren(h('p', null, 'Starting by itself. You can keep this screen open or tap Stop.'));
    start.click();
  }
  stop.addEventListener('click', () => {
    controller?.abort();
    stop.disabled = true;
    status.append(h('p', null, 'Stopping after this photo…'));
  });
}
