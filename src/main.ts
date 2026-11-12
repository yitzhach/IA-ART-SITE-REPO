import './styles.css';
import {setUnauthorizedHandler} from './api';
import {currentUser, signOut, studioName, type Me} from './auth';
import {match, navigate, startRouter} from './router';
import {renderSignIn} from './screens/signin';
import {fillAssistantDefaults} from './lib/assistant-defaults';
import {newLeadCount, refreshLeadBadge} from './lib/lead-badge';
import {h, toast} from './ui';

const root = document.getElementById('app')!;
let me: Me | null = null;

/** Once per app start, after sign-in: the assistant's starting words (D-139) and the new-leads count. */
let started = false;
function afterSignIn(user: Me) {
  if (started || !user.activeStudioId) return;
  started = true;
  void fillAssistantDefaults();
  void refreshLeadBadge();
}

function showSignIn() {
  me = null;
  renderSignIn(root, user => {
    me = user;
    afterSignIn(user);
    // One draw: navigate() redraws through the router, whether or not the path changes.
    navigate(location.pathname.startsWith('/studio') ? location.pathname : '/studio', true);
  });
}

function header(user: Me) {
  const here = match(location.pathname)?.route.name;
  const link = (href: string, text: string, name: string) =>
    h('a', {href, 'aria-current': here === name ? 'page' : null}, text);
  const leads = link('/studio/leads', 'Leads', 'leads');
  const n = newLeadCount();
  leads.append(h('span', {class: 'lead-badge', hidden: n === 0, 'aria-label': 'new'}, String(n)));
  const name = studioName(user);
  return h(
    'header',
    {class: 'hdr'},
    h('div', {class: 'brand'}, name ?? 'Isaac Anderson Art', h('small', null, 'Studio')),
    h(
      'nav',
      null,
      link('/studio/works', 'Works', 'works'),
      link('/studio/add', 'Add', 'add'),
      link('/studio/review', 'Review', 'review'),
      leads,
      link('/studio/site', 'Site', 'site'),
    ),
    h(
      'button',
      {
        class: 'link',
        onclick: () => signOut().then(showSignIn, () => toast('Could not sign out. Try again.')),
      },
      'Sign out',
    ),
  );
}

async function draw() {
  if (!me) return showSignIn();
  const m = match(location.pathname);
  const main = h('main');
  root.replaceChildren(header(me), main);
  if (!me.activeStudioId) {
    main.append(h('p', null, 'This account has no active studio yet. Ask Isaac to add you.'));
    return;
  }
  if (!m) {
    main.append(h('h1', null, 'Not found'), h('a', {href: '/studio'}, 'Back to Works'));
    return;
  }
  try {
    const mod = await m.route.load();
    await mod.render(main, m.params);
  } catch (e) {
    main.replaceChildren(
      h('p', {class: 'err', role: 'alert'}, e instanceof Error ? e.message : 'Something went wrong.'),
    );
  }
}

async function boot() {
  setUnauthorizedHandler(showSignIn);
  me = await currentUser().catch(() => null);
  if (me) afterSignIn(me);
  startRouter(draw); // always, so sign-in, links and Back/Forward work however the app was opened
}
boot();
