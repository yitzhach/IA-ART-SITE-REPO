import {ApiError} from '../api';
import {passwordLogin, requestCode, verifyCode, type Me} from '../auth';
import {h} from '../ui';

/** Sign-in screen. Calls `done(me)` once a session exists. */
export function renderSignIn(el: HTMLElement, done: (me: Me) => void): void {
  let mode: 'email' | 'code' | 'password' = 'email';
  let email = '';
  const draw = (error = '', info = '') => {
    const msg = error ? h('p', {class: 'err', role: 'alert'}, error) : info ? h('p', {class: 'muted'}, info) : null;
    const emailInput = h('input', {id: 'email', type: 'email', autocomplete: 'email', required: true, value: email});
    const fail = (e: unknown) => draw(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    const grab = () => (email = emailInput.value.trim().toLowerCase());
    let form: HTMLElement;
    if (mode === 'email') {
      form = h(
        'form',
        {
          onsubmit: (ev: Event) => {
            ev.preventDefault();
            grab();
            requestCode(email).then(() => {
              mode = 'code';
              draw('', 'We emailed you a code');
            }, fail);
          },
        },
        h('label', {for: 'email'}, 'Email'),
        emailInput,
        h('div', {class: 'row'}, h('button', {class: 'primary', type: 'submit'}, 'Email me a code')),
        h(
          'div',
          {class: 'row'},
          h(
            'button',
            {type: 'button', class: 'link', onclick: () => ((mode = 'password'), draw())},
            'Sign in with password',
          ),
        ),
      );
    } else if (mode === 'code') {
      const code = h('input', {
        id: 'code',
        inputmode: 'numeric',
        autocomplete: 'one-time-code',
        pattern: '\\d{6}',
        maxlength: 6,
        required: true,
      });
      form = h(
        'form',
        {
          onsubmit: (ev: Event) => {
            ev.preventDefault();
            verifyCode(email, code.value.trim()).then(done, fail);
          },
        },
        h('label', {for: 'code'}, `6-digit code sent to ${email}`),
        code,
        h('div', {class: 'row'}, h('button', {class: 'primary', type: 'submit'}, 'Sign in')),
        h(
          'div',
          {class: 'row'},
          h(
            'button',
            {type: 'button', class: 'link', onclick: () => ((mode = 'email'), draw())},
            'Use a different email',
          ),
        ),
      );
    } else {
      const pw = h('input', {id: 'pw', type: 'password', autocomplete: 'current-password', required: true});
      form = h(
        'form',
        {
          onsubmit: (ev: Event) => {
            ev.preventDefault();
            grab();
            passwordLogin(email, pw.value).then(done, fail);
          },
        },
        h('label', {for: 'email'}, 'Email'),
        emailInput,
        h('label', {for: 'pw'}, 'Password'),
        pw,
        h('div', {class: 'row'}, h('button', {class: 'primary', type: 'submit'}, 'Sign in')),
        h(
          'div',
          {class: 'row'},
          h(
            'button',
            {type: 'button', class: 'link', onclick: () => ((grab(), (mode = 'email')), draw())},
            'Email me a code instead',
          ),
        ),
      );
    }
    el.replaceChildren(h('main', null, h('div', {class: 'card'}, h('h1', null, 'Studio sign-in'), msg, form)));
  };
  draw();
}
