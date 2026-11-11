import {h} from '../ui';

/** A toast with one button (for "Deleted. Undo"). */
export function actionToast(message: string, action: string, onAction: () => void, ms = 8000): void {
  const t = h(
    'div',
    {class: 'toast with-action', role: 'status'},
    h('span', null, message),
    h(
      'button',
      {
        class: 'toast-btn',
        onclick: () => {
          t.remove();
          onAction();
        },
      },
      action,
    ),
  );
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
