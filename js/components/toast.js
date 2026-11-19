/**
 * KEEP MASTER PRO - Toast Notification Component
 */

export class Toast {
  static show(message, { actionText = null, onAction = null, duration = 4000 } = {}) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toastEl = document.createElement('div');
    toastEl.className = 'toast';

    const textEl = document.createElement('span');
    textEl.textContent = message;
    toastEl.appendChild(textEl);

    if (actionText && typeof onAction === 'function') {
      const actionBtn = document.createElement('button');
      actionBtn.className = 'toast-action';
      actionBtn.textContent = actionText;
      actionBtn.onclick = () => {
        onAction();
        toastEl.remove();
      };
      toastEl.appendChild(actionBtn);
    }

    container.appendChild(toastEl);

    setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateY(10px)';
      toastEl.style.transition = 'all 200ms ease';
      setTimeout(() => toastEl.remove(), 200);
    }, duration);
  }
}
