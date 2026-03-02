function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(inputId + '-toggle-icon');

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Proteger la ruta: si no hay sesión, redirigir al login.
    await window.sessionManager.initialize();
    if (!window.sessionManager.isLoggedIn()) {
        window.location.href = '/login';
        return;
    }

    const changePasswordForm = document.getElementById('change-password-form');
    const newPasswordInput = document.getElementById('new-password');
    const newPasswordRequirementsContainer = document.getElementById('new-password-requirements');
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');
    const updateButton = document.getElementById('update-button');

    // 2. Reutilizar la lógica de validación en tiempo real
    const requirements = {
        length: { text: 'Al menos 8 caracteres', regex: /.{8,}/, el: null },
        uppercase: { text: 'Una letra mayúscula (A-Z)', regex: /[A-Z]/, el: null },
        lowercase: { text: 'Una letra minúscula (a-z)', regex: /[a-z]/, el: null },
        number: { text: 'Al menos un número (0-9)', regex: /[0-9]/, el: null },
        pwned: { text: 'No debe ser una contraseña común o filtrada', el: null }
    };

    newPasswordRequirementsContainer.innerHTML = Object.values(requirements).map(req => `<li class="requirement-item">${req.text}</li>`).join('');
    Object.keys(requirements).forEach((key, index) => {
        requirements[key].el = newPasswordRequirementsContainer.children[index];
    });

    let pwnedCheckTimeout;
    newPasswordInput.addEventListener('input', () => {
        const password = newPasswordInput.value;
        for (const key in requirements) {
            if (requirements[key].regex) {
                requirements[key].el.classList.toggle('valid', requirements[key].regex.test(password));
            }
        }
        clearTimeout(pwnedCheckTimeout);
        const pwnedRequirement = requirements.pwned;
        pwnedRequirement.el.classList.remove('valid', 'invalid');
        if (password.length >= 8) {
            pwnedCheckTimeout = setTimeout(async () => {
                const isPwned = await AuthApiService.isPasswordPwned(password);
                pwnedRequirement.el.classList.toggle('valid', !isPwned);
                pwnedRequirement.el.classList.toggle('invalid', isPwned);
            }, 500);
        }
    });

    // 3. Lógica de envío del formulario
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';

        const oldPassword = document.getElementById('current-password').value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const matchError = document.getElementById('password-match-error');

        // ✅ VALIDACIÓN: Verificar que las contraseñas coincidan
        if (newPassword !== confirmPassword) {
            matchError.classList.add('show');
            document.getElementById('confirm-password').focus();
            return;
        }
        matchError.classList.remove('show');

        try {
            await AuthApiService.changePassword(oldPassword, newPassword);
            successDiv.textContent = '¡Contraseña actualizada con éxito! Serás redirigido al inicio.';
            successDiv.style.display = 'block';
            setTimeout(() => window.location.href = '/', 2000);
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        }
    });
});