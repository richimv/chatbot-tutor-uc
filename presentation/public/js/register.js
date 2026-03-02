// register.js - Lógica para la página de registro
document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const passwordChecksContainer = document.getElementById('password-requirements');
    const errorDiv = document.getElementById('error-message');
    const registerButton = document.getElementById('register-button');

    // --- 1. Lógica de toggle para ver contraseña ---
    window.togglePassword = function (inputId) {
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
    };

    // --- 2. Lógica de validación de contraseña en tiempo real ---
    const requirements = {
        length: { text: 'Al menos 8 caracteres', regex: /.{8,}/, el: null },
        uppercase: { text: 'Una letra mayúscula (A-Z)', regex: /[A-Z]/, el: null },
        lowercase: { text: 'Una letra minúscula (a-z)', regex: /[a-z]/, el: null },
        number: { text: 'Al menos un número (0-9)', regex: /[0-9]/, el: null },
        pwned: { text: 'No debe ser una contraseña común o filtrada', el: null }
    };

    // Crear los elementos <li> para los requisitos
    if (passwordChecksContainer) {
        passwordChecksContainer.innerHTML = Object.values(requirements)
            .map(req => `<li class="requirement-item">${req.text}</li>`)
            .join('');

        // Guardar referencia a cada <li>
        Object.keys(requirements).forEach((key, index) => {
            requirements[key].el = passwordChecksContainer.children[index];
        });
    }

    let pwnedCheckTimeout;

    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            const password = passwordInput.value;

            // Validar requisitos basados en Regex
            for (const key in requirements) {
                if (requirements[key].regex) {
                    const isValid = requirements[key].regex.test(password);
                    requirements[key].el.classList.toggle('valid', isValid);
                    requirements[key].el.classList.remove('invalid');
                }
            }

            // Validar si la contraseña está comprometida (pwned)
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
    }

    // --- 3. Validación de input de email usuario ---
    const emailUserInput = document.getElementById('email-user');
    const emailDomainSelect = document.getElementById('email-domain');

    if (emailUserInput) {
        emailUserInput.addEventListener('input', () => {
            emailUserInput.value = emailUserInput.value.replace(/[^a-zA-Z0-9._-]/g, '');
        });
    }

    // --- 4. Lógica de envío del formulario ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (errorDiv) errorDiv.style.display = 'none';

            if (!emailUserInput.value.trim()) {
                if (errorDiv) {
                    errorDiv.textContent = "Por favor ingresa tu nombre de usuario de correo.";
                    errorDiv.style.display = 'block';
                }
                return;
            }
            const email = emailUserInput.value.trim() + emailDomainSelect.value;

            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            const name = document.getElementById('name').value;
            const matchError = document.getElementById('password-match-error');

            if (password !== confirmPassword) {
                if (matchError) matchError.classList.add('show');
                confirmPasswordInput.focus();
                return;
            }
            if (matchError) matchError.classList.remove('show');

            registerButton.disabled = true;
            registerButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...';

            try {
                const response = await AuthApiService.register(name, email, password);

                if (response.status === 201) {
                    const successMessage = response.data.message || 'Hemos enviado un enlace de confirmación a tu correo. Verifícalo para entrar.';
                    await Swal.fire({
                        title: '¡Registro Exitoso!',
                        text: successMessage,
                        icon: 'success',
                        background: '#1e293b',
                        color: '#f8fafc',
                        confirmButtonText: 'Entendido',
                        confirmButtonColor: '#2563eb'
                    });
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 1500);
                } else {
                    throw new Error(response.data.message || 'Error inesperado en el registro.');
                }

            } catch (error) {
                console.error('Error Registro:', error);
                if (errorDiv) {
                    errorDiv.textContent = error.message;
                    errorDiv.style.display = 'block';
                }
                registerButton.disabled = false;
                registerButton.textContent = 'Registrarse';
            }
        });
    }

    // --- 5. Lógica Google Register ---
    const googleBtn = document.getElementById('google-register-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            console.log('🔵 Iniciando Registro con Google...');

            if (!window.AppConfig.SUPABASE_URL || window.AppConfig.SUPABASE_URL.includes('INSERT')) {
                alert('⚠️ Error de Configuración: Falta configurar SUPABASE_URL en js/config.js');
                return;
            }

            try {
                const sb = window.supabaseClient;
                const redirectUrl = window.location.hostname === 'localhost'
                    ? 'http://localhost:3000/'
                    : `${window.location.origin}/`;

                const { data, error } = await sb.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: redirectUrl
                    }
                });

                if (error) throw error;
                console.log('🟢 Redirigiendo a Google...', data);

            } catch (err) {
                console.error('❌ Error Google Register:', err);
                alert('Error al registrarse con Google: ' + err.message);
            }
        });
    }
});
