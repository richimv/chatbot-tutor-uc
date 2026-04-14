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

    // ✅ MEJORA: Lógica de sincronización atómica para Google OAuth
    async syncGoogleUser({ email, name, id }) {
        try {
            console.log(`🔄 Sincronizando usuario Google: ${email} (ID: ${id})`);

            // 🎯 CONFIGURACIÓN: Lista de correos con privilegios automáticos (Admin)
            const adminEmails = [
                'admin@uc.edu', 
                'hubacademia01@gmail.com'
            ];

            const isAutoAdmin = adminEmails.includes(email.toLowerCase());

            // 1. Delegamos el registro/sincronización al repositorio (vía stored procedure)
            // Esto es más seguro y atómico para correos institucionales.
            const userData = {
                id: id,
                email: email,
                name: name || email.split('@')[0],
                role: isAutoAdmin ? 'admin' : 'student'
            };

            // El repositorio usa sp_register_user que hace un UPSERT
            let user = await this.userRepository.create(userData);

            if (!user) {
                throw new Error('No se pudo crear o recuperar el usuario de la base de datos.');
            }

            // 2. Provisión de preferencias iniciales si es un usuario nuevo
            try {
                // Usamos 'medicine' como dominio base por defecto para el Tutor IA médico
                const DEFAULT_DOMAIN = 'medicine'; 
                const prefs = await userPreferencesService.getPreferences(id, DEFAULT_DOMAIN);
                
                if (!prefs || Object.keys(prefs).length === 0) {
                    console.log(`✨ Provisionando preferencias iniciales (${DEFAULT_DOMAIN}) para: ${email}`);
                    await userPreferencesService.savePreferences(id, DEFAULT_DOMAIN, {
                        target: 'SERUMS',
                        difficulty: 'Básico',
                        career: 'Medicina Humana',
                        areas: ['Salud Pública', 'Cuidado Integral De Salud', 'Ética E Interculturalidad', 'Investigación', 'Gestión De Servicios De Salud']
                    });
                }
            } catch (prefErr) {
                // Error no crítico: El usuario puede seguir logueado aunque fallen sus preferencias
                console.warn(`⚠️ Sistema de preferencias (Sync): ${prefErr.message}`);
            }

            return user;
        } catch (error) {
            console.error('❌ Error crítico en syncGoogleUser:', error);
            throw new Error(`Error de sincronización: ${error.message}`);
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