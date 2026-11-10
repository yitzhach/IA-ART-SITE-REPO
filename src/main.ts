import './styles.css';
import {setUnauthorizedHandler} from './api';
import {currentUser, signOut, studioName, type Me} from './auth';
import {match, navigate, startRouter} from './router';
import {renderSignIn} from './screens/signin';
import {h, toast} from './ui';

const root = document.getElementById('app')!;
let me: Me | null = null;

function showSignIn() {
  me = null;
  renderSignIn(root, user => {
    me = user;
    navigate(location.pathname.startsWith('/studio') ? location.pathname : '/studio', true);
    draw();
  });
}

function header(user: Me) {
  const here = match(location.pathname)?.route.name;
  const link = (href: string, text: string, name: string) =>
    h('a', {href, 'aria-current': here === name ? 'page' : null}, text);
  const name = studioName(user);
  return h(
    'header',
    {class: 'hdr'},
    h('div', {class: 'brand'}, 'Isaac Anderson Art — Studio', name ? h('small', null, name) : null),
    h(
      'nav',
      null,
      link('/studio/works', 'Works', 'works'),
      link('/studio/add', 'Add', 'add'),
      link('/studio/review', 'Review', 'review'),
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
  if (!me) return;
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
  if (!me) return showSignIn();
  startRouter(draw);
}
boot();
