/**
 * confirmationModal.js
 * 
 * Maneja la lógica del modal de confirmación personalizado.
 * Reemplaza la funcionalidad nativa de confirm() con una experiencia de usuario más integrada.
 */

class ConfirmationModal {
    constructor() {
        this.modal = document.getElementById('confirmation-modal');
        this.titleElement = document.getElementById('confirmation-modal-title');
        this.messageElement = document.getElementById('confirmation-modal-message');
        this.confirmBtn = document.getElementById('confirmation-modal-confirm');
        this.cancelBtn = document.getElementById('confirmation-modal-cancel');
        this.closeBtn = this.modal.querySelector('.modal-close');

        this.resolvePromise = null;

        this.init();
    }

    init() {
        // Bindeamos los métodos para no perder el contexto 'this'
        this.handleConfirm = this.handleConfirm.bind(this);
        this.handleCancel = this.handleCancel.bind(this);

        this.confirmBtn.addEventListener('click', this.handleConfirm);
        this.cancelBtn.addEventListener('click', this.handleCancel);
        this.closeBtn.addEventListener('click', this.handleCancel);

        // Cerrar al hacer clic fuera del modal (overlay)
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.handleCancel();
            }
        });

        // Soporte para cerrar con la tecla Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display === 'flex') {
                this.handleCancel();
            }
        });
    }

    /**
     * Muestra el modal de confirmación y devuelve una Promesa.
     * @param {string} message - El mensaje a mostrar.
     * @param {string} title - El título del modal (opcional).
     * @param {string} confirmText - Texto del botón de confirmar (opcional).
     * @param {string} cancelText - Texto del botón de cancelar (opcional).
     * @returns {Promise<boolean>} - Se resuelve a true si se confirma, false si se cancela.
     */
    /**
     * Muestra el modal de confirmación y devuelve una Promesa.
     * @param {string} message - El mensaje a mostrar.
     * @param {string} title - El título del modal (opcional).
     * @param {string} confirmText - Texto del botón de confirmar (opcional).
     * @param {string} cancelText - Texto del botón de cancelar (opcional).
     * @returns {Promise<boolean>} - Se resuelve a true si se confirma, false si se cancela.
     */
    show(message, title = 'Confirmación', confirmText = 'Confirmar', cancelText = 'Cancelar') {
        this.messageElement.textContent = message;
        this.titleElement.textContent = title;
        this.confirmBtn.textContent = confirmText;
        this.cancelBtn.textContent = cancelText;

        // Asegurar que ambos botones estén visibles (por si se usó showAlert antes)
        this.cancelBtn.style.display = 'flex';
        this.confirmBtn.style.display = 'flex';

        this.modal.style.display = 'flex';
        this.confirmBtn.focus(); // Accesibilidad: poner foco en la acción principal

        return new Promise((resolve) => {
            this.resolvePromise = resolve;
        });
    }

    /**
     * Muestra un modal de alerta (solo botón de aceptar).
     * @param {string} message - El mensaje a mostrar.
     * @param {string} title - El título del modal (opcional).
     * @param {string} buttonText - Texto del botón (opcional).
     * @returns {Promise<void>} - Se resuelve cuando el usuario cierra la alerta.
     */
    showAlert(message, title = 'Aviso', buttonText = 'Aceptar') {
        this.messageElement.innerHTML = message.replace(/\n/g, '<br>'); // Permitir saltos de línea
        this.titleElement.textContent = title;
        this.confirmBtn.textContent = buttonText;

        // Ocultar botón de cancelar
        this.cancelBtn.style.display = 'none';
        this.confirmBtn.style.display = 'flex';

        this.modal.style.display = 'flex';
        this.confirmBtn.focus();

        return new Promise((resolve) => {
            this.resolvePromise = () => resolve();
        });
    }

    handleConfirm() {
        this.close();
        if (this.resolvePromise) {
            this.resolvePromise(true);
            this.resolvePromise = null;
        }
    }

    handleCancel() {
        this.close();
        if (this.resolvePromise) {
            this.resolvePromise(false);
            this.resolvePromise = null;
        }
    }

    close() {
        this.modal.style.display = 'none';
    }
}
