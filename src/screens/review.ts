import {
  INVALID,
  collectionField,
  markDrafted,
  priceField,
  sizeField,
  statusField,
  tagField,
  textField,
} from '../components/fields';
import {mount} from '../components/mount';
import {picture} from '../components/picture';
import {
  CONFLICT_MESSAGE,
  getWork,
  isConflict,
  listAll,
  listCollections,
  plainError,
  publishWork,
  setAltText,
  updateWork,
} from '../lib/artworks';
import {changedFields, isDraft, missingFacts, missingText} from '../lib/work-logic';
import type {Params} from '../router';
import type {ArtworkDetail, ArtworkInput} from '../types';
import {h, toast} from '../ui';

/** The drafts to go through: not public, oldest first. */
export const draftQueue = <T extends {public: boolean; status: string; createdAt: string}>(works: T[]): T[] =>
  works.filter(isDraft).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export async function render(el: HTMLElement, params: Params): Promise<void> {
  mount(el, h('h1', null, 'Review drafts'), h('p', {class: 'muted'}, 'Loading your drafts…'));
  let queue: {id: string}[];
  let publicCount: number;
  let collections: string[];
  try {
    const [all, cols] = await Promise.all([listAll(), listCollections()]);
    queue = draftQueue(all);
    publicCount = all.filter(w => w.public).length;
    collections = cols;
  } catch (e) {
    mount(
      el,
      h('h1', null, 'Review drafts'),
      h(
        'p',
        {class: 'err', role: 'alert'},
        plainError(e, "Couldn't load your drafts. Check your connection and try again."),
      ),
      h('button', {onclick: () => render(el, params)}, 'Try again'),
    );
    return;
  }

  const total = queue.length;
  let at = 0;
  let skipped = 0;

  const done = () => {
    mount(
      el,
      h('h1', null, 'All caught up'),
      h(
        'div',
        {class: 'card empty'},
        h('p', null, publicCount === 1 ? '1 work is public.' : `${publicCount} works are public.`),
        skipped
          ? h(
              'p',
              {class: 'muted'},
              skipped === 1 ? '1 draft was skipped for now.' : `${skipped} drafts were skipped for now.`,
            )
          : null,
        h('div', {class: 'row'}, h('a', {class: 'btn primary', href: '/studio/works'}, 'See all works')),
      ),
    );
  };

  async function showCurrent(notice = ''): Promise<void> {
    if (!el.isConnected) return;
    const entry = queue[at];
    if (!entry) return done();
    let a: ArtworkDetail;
    try {
      a = await getWork(entry.id);
    } catch (e) {
      mount(
        el,
        h('h1', null, 'Review drafts'),
        h('p', {class: 'err', role: 'alert'}, plainError(e, "Couldn't open this draft.")),
        h(
          'div',
          {class: 'row'},
          h('button', {onclick: () => void showCurrent()}, 'Try again'),
          h('button', {onclick: () => next(true)}, 'Skip'),
        ),
      );
      return;
    }
    if (!isDraft(a)) return next(false); // published somewhere else meanwhile
    draw(a, notice);
  }

  const next = (wasSkipped: boolean) => {
    if (wasSkipped) skipped++;
    at++;
    window.scrollTo?.(0, 0);
    void showCurrent();
  };

  function draw(art: ArtworkDetail, notice: string) {
    // `a` and `cover` follow the server after a partial success, so a retry uses the right versions.
    let a = art;
    let cover = a.images[0] ?? null;
    const drafted = new Set<string>(a.draftedFields ?? []);
    const description = textField('Description', a.description, {multiline: true, rows: 6});
    const tags = tagField(a.tags);
    const collection = collectionField(a.collection, collections);
    const alt = textField('Photo description (for people who can’t see it)', cover?.altText ?? '', {
      multiline: true,
      rows: 3,
    });
    const size = sizeField({width: a.width, height: a.height, depth: a.depth, sizeUnit: a.sizeUnit});
    const price = priceField(a.priceCents);
    const status = statusField(a.status);
    if (drafted.has('description')) markDrafted(description);
    if (drafted.has('tags')) markDrafted(tags);
    if (drafted.has('collection')) markDrafted(collection);
    if (drafted.has('altText')) markDrafted(alt);

    const missing = missingFacts(a);
    if (missing.includes('size')) size.el.classList.add('missing');
    if (missing.includes('price')) price.el.classList.add('missing');
    if (missing.includes('status')) status.el.classList.add('missing');

    const problem = h('p', {class: 'err', role: 'alert', hidden: true});
    const approve = h('button', {class: 'primary big-btn', type: 'button'}, 'Approve');
    const skip = h('button', {class: 'big-btn', type: 'button', onclick: () => next(true)}, 'Skip');
    const setBusy = (b: boolean) => {
      approve.disabled = b;
      skip.disabled = b;
    };

    approve.addEventListener('click', async () => {
      const s = size.read(),
        p = price.read();
      if (s === INVALID) return size.focus();
      if (p === INVALID) return price.focus();
      const after: Partial<ArtworkInput> = {
        description: description.read() as string,
        tags: tags.read() as string[],
        collection: collection.read() as string | null,
        width: s.width,
        height: s.height,
        depth: s.depth,
        sizeUnit: s.sizeUnit,
        priceCents: p,
        status: status.read() as ArtworkInput['status'],
      };
      const edits = changedFields(
        {
          description: a.description,
          tags: a.tags,
          collection: a.collection,
          width: a.width,
          height: a.height,
          depth: a.depth,
          sizeUnit: a.sizeUnit,
          priceCents: a.priceCents,
          status: a.status,
        } as Partial<ArtworkInput>,
        after,
      );
      const altText = alt.read() as string;
      problem.hidden = true;
      setBusy(true);
      try {
        let version = a.version;
        if (Object.keys(edits).length) version = (await updateWork(a.id, edits, version)).version;
        if (cover && altText !== (cover.altText ?? '')) await setAltText(cover, altText);
        await publishWork(a.id, version);
      } catch (e) {
        setBusy(false);
        if (isConflict(e)) return void showCurrent(CONFLICT_MESSAGE);
        try {
          a = await getWork(a.id); // part of it may have been saved
          cover = a.images[0] ?? null;
        } catch {
          // offline: the retry will say so
        }
        problem.textContent = plainError(e, "This work couldn't be approved. Nothing was lost. Try again.");
        problem.hidden = false;
        return;
      }
      publicCount++;
      toast('Approved. It is public now.');
      next(false);
    });

    mount(
      el,
      h(
        'div',
        {class: 'review-head'},
        h('h1', null, 'Review drafts'),
        h('span', {class: 'counter'}, `${at + 1} of ${total}`),
      ),
      notice ? h('p', {class: 'err', role: 'alert'}, notice) : null,
      h('h2', {class: 'work-title-big'}, a.title || 'Untitled'),
      picture(cover, 960, {alt: cover?.altText ?? a.title}),
      h(
        'div',
        {class: missing.length ? 'card facts needs' : 'card facts'},
        missing.length
          ? h('p', {class: 'missing-line'}, missingText(missing))
          : h('p', {class: 'muted'}, 'Size, price and status are filled in.'),
        size.el,
        price.el,
        status.el,
      ),
      h('div', {class: 'card'}, description.el, tags.el, collection.el, cover ? alt.el : null),
      problem,
      h('div', {class: 'review-actions'}, approve, skip),
    );
  }

  await showCurrent();
}
