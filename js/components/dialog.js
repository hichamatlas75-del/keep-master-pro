/**
 * KEEP MASTER PRO - Confirmation and Alert Dialog Component
 */

export class Dialog {
  static confirm({ title = 'Confirmation', message, confirmText = 'Confirmer', cancelText = 'Annuler', isDanger = false }) {
    return new Promise((resolve) => {
      const container = document.getElementById('modalsContainer');
      if (!container) return resolve(false);

      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';

      backdrop.innerHTML = `
        <div class="modal-content" style="max-width: 440px;">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
          </div>
          <div class="modal-body">
            <p style="color:var(--text-secondary);line-height:1.6;">${message}</p>
          </div>
          <div class="modal-footer">
            <button id="dialogCancelBtn" class="btn-secondary">${cancelText}</button>
            <button id="dialogConfirmBtn" class="${isDanger ? 'btn-danger' : 'btn-primary'}">${confirmText}</button>
          </div>
        </div>
      `;

      container.appendChild(backdrop);

      const cleanup = (result) => {
        backdrop.remove();
        resolve(result);
      };

      backdrop.querySelector('#dialogCancelBtn').onclick = () => cleanup(false);
      backdrop.querySelector('#dialogConfirmBtn').onclick = () => cleanup(true);
      backdrop.onclick = (e) => {
        if (e.target === backdrop) cleanup(false);
      };
    });
  }
}
