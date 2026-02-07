const UserRepository = require('../../domain/repositories/userRepository');
const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken'); // ❌ YA NO SE USA
const crypto = require('crypto');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const supabase = require('../../infrastructure/config/supabaseClient'); // ✅ SUPABASE CLEINT

const JWT_SECRET = process.env.JWT_SECRET || 'este-es-un-secreto-muy-largo-y-seguro-para-desarrollo';

class AuthService {
    constructor() {
        this.userRepository = new UserRepository();
    }

    /**
     * Verifica si una contraseña ha sido expuesta en brechas de seguridad de datos
     * utilizando la API de 'Have I Been Pwned' (HIBP) de forma segura.
     * @param {string} password La contraseña a verificar.
     * @returns {Promise<boolean>} Devuelve `true` si la contraseña está comprometida, `false` en caso contrario.
     */
    async isPasswordPwned(password) {
        try {
            // 1. Crear un hash SHA-1 de la contraseña.
            const sha1Hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
            const prefix = sha1Hash.substring(0, 5);
            const suffix = sha1Hash.substring(5);

            // 2. Enviar solo el prefijo a la API de HIBP.
            const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`);

            // 3. Buscar el sufijo en la respuesta de la API.
            // La respuesta es una lista de sufijos y su conteo de apariciones.
            return response.data.split('\r\n').some(line => line.split(':')[0] === suffix);
        } catch (error) {
            console.error('Error al verificar la contraseña con HIBP:', error.message);
            return false; // En caso de error, no bloqueamos el registro por seguridad.
        }
    }

    /**
     * Valida la complejidad de una contraseña.
     * @param {string} password La contraseña a validar.
     * @throws {Error} Si la contraseña no cumple con los requisitos.
     */
    validatePasswordComplexity(password) {
        const minLength = 8;
        const errors = [];

        if (!password || password.length < minLength) {
            errors.push(`debe tener al menos ${minLength} caracteres`);
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('debe contener al menos una mayúscula');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('debe contener al menos una minúscula');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('debe contener al menos un número');
        }

        if (errors.length > 0) {
            throw new Error(`La contraseña es débil: ${errors.join(', ')}.`);
        }
    }

    async login(email, password) {
        // 1. Autenticar con Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw new Error(error.message); // ej: "Invalid login credentials"
        }

        const session = data.session; // token, refresh_token
        const sbUser = data.user;

        // 2. Obtener usuario local (Roles, Suscripción, etc)
        // CRÍTICO: El ID de Supabase debe coincidir con el ID local.
        const localUser = await this.userRepository.findById(sbUser.id);

        if (!localUser) {
            // Caso borde: Usuario existe en Supabase pero no en DB local (Desincronizado)
            console.error(`⚠️ Login exitoso en Supabase pero usuario local no encontrado (ID: ${sbUser.id})`);
            throw new Error('Usuario no registrado en la base de datos interna.');
        }

        // 3. Retornar sesión y usuario
        return { session, user: localUser };
    }

    async register(email, password, name) {
        // 1. Validaciones previas (Locales)
        const existingUser = await this.userRepository.findByEmail(email);
        if (existingUser) {
            throw new Error('El correo electrónico ya está en uso');
        }

        this.validatePasswordComplexity(password);
        if (await this.isPasswordPwned(password)) {
            throw new Error('Esa contraseña ha sido expuesta en brechas de seguridad. Por favor, elige una más segura.');
        }

        // 2. Crear usuario en Supabase (Auth)
        let userId = null;
        let isAutoVerified = false;

        // ✅ LOGICA ESPECIAL: Auto-verificar dominios @hubacademia.com
        if (email.endsWith('@hubacademia.com')) {
            console.log(`🏢 Registro corporativo detectado: ${email}. Usando Admin API para auto-verificación.`);
            const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

            const { data, error } = await supabaseAdmin.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true, // ✅ ESTO ACTIVA LA CUENTA AL INSTANTE
                user_metadata: { full_name: name, email_verified: true }
            });

            if (error) {
                console.error('Error Supabase Admin CreateUser:', error);
                throw new Error(error.message);
            }
            userId = data.user.id;
            isAutoVerified = true;

        } else {
            // Flujo Estandar (Gmail, Outlook, etc)
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: name } // Meta-data pública
                }
            });

            if (error) {
                console.error('Error Supabase SignUp:', error);
                throw new Error(error.message);
            }

            if (!data.user || !data.user.id) {
                throw new Error('Error inesperado: No se pudo obtener el ID de usuario de Supabase.');
            }
            userId = data.user.id;
        }

        // 3. Crear usuario en Base de Datos Local (Public)
        try {
            await this.userRepository.create(email, password, name, 'student', userId);
        } catch (dbError) {
            console.error('Error creando usuario local (Rollback pendiente):', dbError);
            // Opcional: Borrar de Supabase si falla la DB local
            if (isAutoVerified) {
                const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                await supabaseAdmin.auth.admin.deleteUser(userId);
            }
            throw new Error('Error al crear el perfil de usuario. Por favor contacte a soporte.');
        }

        if (isAutoVerified) {
            return {
                message: 'Registro exitoso. Tu cuenta corporativa ha sido activada automáticamente. Puedes iniciar sesión.'
            };
        } else {
            return {
                message: 'Registro exitoso. Se ha enviado un correo de confirmación.'
            };
        }
    }

    // ✅ NUEVO: Lógica para cambiar la contraseña (Supabase).
    async changePassword(userId, oldPassword, newPassword) {
        // 1. Validaciones previas
        this.validatePasswordComplexity(newPassword);
        if (await this.isPasswordPwned(newPassword)) {
            throw new Error('La nueva contraseña ha sido expuesta en brechas de seguridad. Por favor, elige una diferente.');
        }

        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('Usuario no encontrado.');
        }

        // 2. Verificar la contraseña ANTIGUA con Supabase
        // Intentamos hacer login con la password antigua.
        // Esto verifica que el usuario conoce su clave actual.
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: oldPassword
        });

        if (signInError) {
            console.warn(`Falló verificación de password antiguo para ${user.email}:`, signInError.message);
            throw new Error('La contraseña antigua es incorrecta.');
        }

        // 3. Actualizar contraseña en Supabase
        // Usamos admin.updateUserById para forzar el cambio sin necesitar la sesión activa del usuario
        // (aunque con signInWithPassword acabamos de obtener una sesión, pero updateUserById es más directo si tenemos permisos de admin/service role)
        // O si no tenemos service role, usamos supabase.auth.updateUser com la sesión obtenida.

        // Vamos a usar la sesión que acabamos de obtener (o una nueva operación de update)
        // NOTA: signInWithPassword NO actualiza la sesión global del cliente backend automáticamente en todas las versiones.
        // Mejor enfoque: Usar admin api si está disponible (Service Role) O usar updateUser con el token del login recién hecho.

        // Opción Segura Backend (sin Service Role Key expuesta si no la tenemos):
        // Necesitamos la sesión del usuario para cambiar SU contraseña.
        // Al hacer signInWithPassword, recibimos data.session.

        const { data: signInData } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: oldPassword
        });

        if (!signInData.session) {
            throw new Error('Error de sesión al verificar credenciales.');
        }

        // Instancia temporal con el token del usuario
        // Esto requiere que creaseClient sea capaz de usar un token específico...
        // O usamos supabase.auth.updateUser, pero eso usa la instancia global...
        // LA VERDADERA FORMA en backend con sdk JS: 
        // supabase.auth.setSession(signInData.session) -> NO ES THREAD SAFE en backend Node!!!


        // SOLUCIÓN ROBUSTA: Usar Admin API (requiere SERVICE_ROLE_KEY).
        const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id, // ID Supabase (debe coincidir con nuestro ID local)
            { password: newPassword }
        );

        if (updateError) {
            console.error('Error Admin Update:', updateError);
            throw new Error('Error actualizando contraseña. Contacte a soporte.');
        }

        // 4. Actualizar localmente también (Backup)
        // Aunque ya no lo usamos para login, mantenemos la consistencia por si acaso.
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await this.userRepository.updatePassword(userId, newPasswordHash);
    }

    // ✅ NUEVO: Solicitar recuperación de contraseña (Supabase)
    async requestPasswordReset(email) {
        // Validación opcional: verificar que el email existe en nuestra DB primero
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            // Por seguridad, no deberíamos decir si el correo existe o no, 
            // pero para UX a veces se informa. Supabase devuelve éxito siempre (200) por seguridad.
            // Retornamos éxito falso para simular envío.
            return { message: 'Si el correo está registrado, recibirás un enlace de recuperación.' };
        }

        const frontendUrl = process.env.FRONTEND_URL || 'https://www.hubacademia.com';
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${frontendUrl}/update-password`
        });

        if (error) {
            // Manejar rate limits u otros errores
            console.error('Error enviando correo de recuperación:', error);
            if (error.status === 429) {
                throw new Error('Demasiadas solicitudes. Por favor espera unos minutos.');
            }
            throw new Error('Error al enviar el correo de recuperación.');
        }

        return { message: 'Si el correo está registrado, recibirás un enlace de recuperación.' };
    }

    // ✅ NUEVO: Lógica para que un admin restablezca una contraseña.
    async adminResetPassword(userIdToReset) {
        const user = await this.userRepository.findById(userIdToReset);
        if (!user) {
            throw new Error('Usuario no encontrado.');
        }

        const newPassword = Math.random().toString(36).slice(-8);
        console.log(`🔑 (Admin) Nueva contraseña temporal generada para ${user.email}: ${newPassword}`);

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await this.userRepository.updatePassword(userIdToReset, newPasswordHash);

        return { newPassword };
    }
    // ✅ NUEVO: Sincronización impulsada por Frontend (Google Login)
    async syncGoogleUser({ email, name, id }) {
        let user = await this.userRepository.findByEmail(email);

        if (!user) {
            console.log(`🔄 Sincronizando usuario nuevo de Google: ${email}`);
            // Crear usuario usando el ID de Supabase
            // Generamos una contraseña aleatoria compleja ya que no la usarán (entran por Google)
            const randomPassword = crypto.randomBytes(16).toString('hex');

            user = await this.userRepository.create(email, randomPassword, name || 'Usuario Google', 'student', id);
        } else {
            // Opcional: Podríamos verificar si el ID coincide, pero por ahora confiamos en el email
            // Si el ID es diferente, podría ser un caso de login híbrido (manual previo + google despues)
            // Postgres no cambiará el ID existente.
            console.log(`✅ Usuario Google ya existe localmente: ${email}`);
        }

        return user;
    }
    // ✅ NUEVO: Eliminar cuenta permanente
    async deleteAccount(userId, password) {
        // 1. Validar que el usuario existe localmente
        const user = await this.userRepository.findById(userId);
        if (!user) throw new Error('Usuario no encontrado.');

        // 2. Verificar contraseña con Supabase (Doble factor de seguridad)
        const { error } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: password
        });

        if (error) {
            console.warn(`Intento fallido de eliminación de cuenta para ${user.email}:`, error.message);
            throw new Error('Contraseña incorrecta. No se pudo verificar la identidad.');
        }

        // 3. Eliminar de Supabase (Admin API)
        // 3. Eliminar de Supabase (Admin API)
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            console.error('❌ FATAL: SUPABASE_SERVICE_ROLE_KEY no está definido en variables de entorno.');
            throw new Error('Error de configuración del servidor (Missing Key).');
        }

        const supabaseAdmin = createClient(process.env.SUPABASE_URL, serviceRoleKey);
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
            console.error('Error eliminando usuario de Supabase:', deleteError);
            throw new Error('Error al eliminar la cuenta en el proveedor de identidad.');
        }

        // 4. Eliminar de Base de Datos Local
        // Gracias al ON DELETE CASCADE, esto borrará chats, favoritos, etc.
        await this.userRepository.delete(userId);

        return { success: true };
    }
}

module.exports = AuthService;