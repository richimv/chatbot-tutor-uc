// Toggle Password Visibility
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
    const updateButton = document.getElementById('update-button');
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');

    // Inicializar Cliente Supabase
    if (!window.AppConfig.SUPABASE_URL) {
        errorDiv.textContent = "Error de configuración: Faltan variables de entorno.";
        errorDiv.style.display = 'block';
        return;
    }
    const supabase = window.supabase.createClient(window.AppConfig.SUPABASE_URL, window.AppConfig.SUPABASE_ANON_KEY);

    // 1. Escuchar el evento de recuperación de contraseña de Supabase
    // Supabase v2 parsea automáticamente el #access_token de la URL. No lo hagamos manualmente.
    let isRecoverySession = false;

    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('🔄 Estado de Autenticación:', event);

        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
            isRecoverySession = true;

            // 🛡️ PROTECCIÓN PREVENTIVA GOOGLE
            const user = session?.user;
            const isGoogleProvider = user?.app_metadata?.provider === 'google';

            if (isGoogleProvider) {
                // Notificar de inmediato y ocultar formulario
                const form = document.getElementById('update-password-form');
                if (form) form.style.display = 'none';

                errorDiv.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <i class="fab fa-google" style="font-size: 3rem; color: #4285F4; margin-bottom: 15px;"></i>
                        <h3 style="color: #f8fafc; margin-bottom: 10px;">Cuenta Vinculada a Google</h3>
                        <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.6;">
                            Tu seguridad se gestiona directamente desde Google Account. <br>
                            No es necesario establecer una contraseña local.
                        </p>
                        <button onclick="window.location.href='/'" class="btn-secondary" style="margin-top: 20px; width: 100%;">
                            Volver al Inicio
                        </button>
                    </div>
                `;
                errorDiv.style.display = 'block';
                errorDiv.style.background = 'rgba(30, 41, 59, 0.5)';
                errorDiv.style.border = '1px solid rgba(66, 133, 244, 0.3)';
            }
        }
    });

    // 2. Validación visual de la contraseña
    const newPassInput = document.getElementById('new-password');
    const reqList = document.getElementById('new-password-requirements');
    const requirements = [
        { regex: /.{8,}/, text: "Mínimo 8 caracteres" },
        { regex: /[A-Z]/, text: "Una mayúscula" },
        { regex: /[0-9]/, text: "Un número" }
    ];

    reqList.innerHTML = requirements.map(r => `<li class="requirement-item">${r.text}</li>`).join('');

    newPassInput.addEventListener('input', () => {
        const val = newPassInput.value;
        Array.from(reqList.children).forEach((li, idx) => {
            const req = requirements[idx];
            const isValid = req.regex.test(val);
            li.classList.toggle('valid', isValid);
            li.classList.remove('invalid');
        });
    });

    // 3. Manejar Envío de Nueva Contraseña
    document.getElementById('update-password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';

        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            document.getElementById('password-match-error').classList.add('show');
            return;
        } else {
            document.getElementById('password-match-error').classList.remove('show');
        }

        if (!isRecoverySession) {
            errorDiv.textContent = "La sesión de recuperación es inválida o expiró. Por favor solicita un nuevo correo de recuperación.";
            errorDiv.style.display = 'block';
            return;
        }

        updateButton.disabled = true;
        updateButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        try {
            // 3.1 Obtener sesión actual (Garantizada por el AuthStateChange si esRecovery)
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) throw new Error("No hay una sesión activa para cambiar la contraseña.");

            // 3.2 Protección contra Cuentas de Google
            // Si el proveedor de identidad fue Google, no pueden setear contraseña manualmente
            const isGoogleProvider = user.app_metadata && user.app_metadata.provider === 'google';
            if (isGoogleProvider) {
                throw new Error("Estás autenticado mediante Google. Tu contraseña se administra desde tu cuenta de Google. Serás redirigido al inicio.");
            }

            // 3.3 Actualizar Contraseña en Supabase
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            // 3.4 Éxito y Limpieza
            successDiv.innerHTML = '<i class="fas fa-check-circle"></i> ¡Contraseña actualizada correctamente! Redirigiendo...';
            successDiv.style.display = 'block';

            // Opcionalmente cerrar sesión si deseas forzar login, pero por defecto Supabase los mantiene logueados.
            setTimeout(() => {
                window.location.href = '/login';
            }, 2500);

        } catch (err) {
            console.error("Update Password Error:", err);
            errorDiv.textContent = "Error: " + err.message;
            errorDiv.style.display = 'block';

            updateButton.disabled = false;
            updateButton.textContent = "Guardar Contraseña";

            // Manejo Especial Redirección Google
            if (err.message.includes('cuenta de Google')) {
                setTimeout(() => window.location.href = '/', 3500);
            }
        }
    });
});