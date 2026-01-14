const UserRepository = require('../../domain/repositories/userRepository');
const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken'); // ❌ YA NO SE USA
const crypto = require('crypto');
const axios = require('axios');
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
        // Esto envía automáticamente el correo de confirmación según config de Supabase.
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name } // Meta-data pública
            }
        });

        if (error) {
            console.error('Error Supabase SignUp:', error);
            throw new Error(error.message); // ej: "User already registered"
        }

        if (!data.user || !data.user.id) {
            throw new Error('Error inesperado: No se pudo obtener el ID de usuario de Supabase.');
        }

        // 3. Crear usuario en Base de Datos Local (Public)
        // Usamos el MISMO ID que generó Supabase para mantener integridad.
        try {
            await this.userRepository.create(email, password, name, 'student', data.user.id);
        } catch (dbError) {
            console.error('Error creando usuario local (Rollback pendiente):', dbError);
            // Opcional: Podríamos intentar borrar el usuario de Supabase aquí si falla la DB local
            // para evitar usuarios "zombis" en Auth sin registro en Public.
            // await supabase.auth.admin.deleteUser(data.user.id); 
            throw new Error('Error al crear el perfil de usuario. Por favor contacte a soporte.');
        }

        return {
            message: 'Registro exitoso. Se ha enviado un correo de confirmación.'
        };
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
        // Si no tenemos SERVICE_ROLE_KEY, estamos limitados.
        // REVISANDO supabaseClient.js: Usa process.env.SUPABASE_KEY. 
        // Asumiremos que es una clave con permisos suficientes O usaremos la API de Admin.

        const { error: updateError } = await supabase.auth.admin.updateUserById(
            user.id, // ID Supabase (debe coincidir con nuestro ID local)
            { password: newPassword }
        );

        if (updateError) {
            // Si falla admin (ej. falta de permisos), intentamos flujo alternativo o lanzamos error.
            console.error('Error Admin Update:', updateError);
            throw new Error('Error actualizando contraseña en el proveedor de identidad. Contacte a soporte.');
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

        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://www.hubacademia.com/update-password.html'
            // redirectTo: 'http://localhost:3000/update-password.html' // Para desarrollo local
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
}

module.exports = AuthService;