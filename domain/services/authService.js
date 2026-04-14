const UserRepository = require('../../domain/repositories/userRepository');
const UserPreferencesService = require('../../domain/services/userPreferencesService');
const userPreferencesService = new UserPreferencesService();
const supabase = require('../../infrastructure/config/supabaseClient'); // ✅ SUPABASE CLIENT

const JWT_SECRET = process.env.JWT_SECRET || 'este-es-un-secreto-muy-largo-y-seguro-para-desarrollo';

class AuthService {
    constructor() {
        this.userRepository = new UserRepository();
    }

    /**
     * Obtiene el usuario local enriquecido con su estado de verificación.
     */
    async getUserWithStatus(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) return null;

        try {
            const { createClient } = require('@supabase/supabase-js');
            const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const { data: { user: sbUser }, error } = await supabaseAdmin.auth.admin.getUserById(userId);

            if (!error && sbUser) {
                user.emailVerified = !!sbUser.email_confirmed_at;
            } else {
                user.emailVerified = false;
            }
        } catch (err) {
            console.warn(`⚠️ Error de sincronización Supabase para ${userId}:`, err.message);
            user.emailVerified = false;
        }

        return user;
    }

    // ✅ NUEVO: Lógica de sincronización para Google OAuth
    async syncGoogleUser({ email, name, id }) {
        try {
            console.log(`🔄 Sincronizando usuario Google: ${email} (ID: ${id})`);

            // 1. Buscar si ya existe en nuestra DB local (por email)
            let user = await this.userRepository.findByEmail(email);

            if (!user) {
                // 2. Si no existe, lo creamos
                console.log(`✨ Creando nuevo usuario desde Google: ${email}`);

                // 🎯 CONFIGURACIÓN: Lista de correos con privilegios automáticos (Admin)
                const adminEmails = [
                    'admin@uc.edu', // Legacy admin
                    // Agrega aquí tus correos de Gmail personales para que sean Admin al entrar:
                    'hubacademia01@gmail.com'
                ];

                const isAutoAdmin = adminEmails.includes(email.toLowerCase());

                // Estructura básica para nuevo usuario
                const newUser = {
                    id: id, // Usamos el ID de Supabase
                    email: email,
                    name: name || email.split('@')[0],
                    role: isAutoAdmin ? 'admin' : 'student', // Asignación inteligente de rol
                    lives: 5,        // Vidas iniciales
                    createdAt: new Date()
                };

                user = await this.userRepository.create(newUser);

                // 🎯 PROVISIÓN AUTOMÁTICA: Configuración SERUMS por defecto
                await userPreferencesService.savePreferences(id, 'medicine', {
                    target: 'SERUMS',
                    difficulty: 'Básico',
                    career: 'Medicina Humana',
                    areas: [
                        'Salud Pública',
                        'Cuidado Integral De Salud',
                        'Ética E Interculturalidad',
                        'Investigación',
                        'Gestión De Servicios De Salud'
                    ]
                });
                console.log(`🚀 Preferences provisioned for ${email}`);
            } else {
                // 3. Si existe, podríamos actualizar su nombre si cambió en Google
                if (name && user.name !== name) {
                    await this.userRepository.update(user.id, { name });
                }
            }

            return user;
        } catch (error) {
            console.error('Error en syncGoogleUser:', error);
            throw new Error('Error al sincronizar perfil con Google.');
        }
    }

    // --- Método deleteAccount simplificado para Google OAuth ---

    /**
     * Eliminar cuenta de usuario
     * @param {string} userId
     */
    async deleteAccount(userId) {
        // En un flujo Google-Only, no pedimos password para borrar.
        // El usuario ya está autenticado por OAuth.

        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            throw new Error('Error de configuración del servidor.');
        }
        const { createClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createClient(process.env.SUPABASE_URL, serviceRoleKey);

        // 1. Eliminar de Supabase (Admin API)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
            console.error('Error eliminando usuario de Supabase:', deleteError);
            throw new Error('Error al eliminar la cuenta en el proveedor.');
        }

        // 2. Eliminar de Base de Datos Local
        await this.userRepository.delete(userId);

        return { success: true };
    }
}

module.exports = AuthService;