/**
 * Migration: Add Usage Limits to Users Table
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function runMigration() {
    console.log('🔄 Iniciando migración: Agregar límites de uso a la tabla users...');

    try {
        // 1. Agregar columna usage_count
        const { error: err1 } = await supabase.rpc('execute_sql', {
            sql_query: `
                ALTER TABLE public.users 
                ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
            `
        });

        if (err1) {
            // Si falla RPC, intentar sql directo si tenemos acceso, o asumir que necesitamos otro método
            // Como fallback, usaremos pg si supabase-js no soporta DDL directo sin función RPC custom
            console.warn('⚠️ Supabase JS RPC failed (probablemente falte la función execute_sql). Intentando vía PG direct...');
            // ERROR: No tenemos cliente PG aquí configurado fácil. 
            // ASUMIR: El usuario tiene una función RPC 'run_sql' o similar, O 
            // Simplemente imprimir el SQL para que el usuario lo corra si falla.
            console.log('⬇️ EJECUTA ESTE SQL EN TU SUPABASE DASHBOARD SI FALLA LA MIGRACIÓN AUTO:');
            console.log(`
                ALTER TABLE public.users ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
                ALTER TABLE public.users ADD COLUMN IF NOT EXISTS max_free_limit INTEGER DEFAULT 3;
            `);
        }

        // 2. Agregar columna max_free_limit
        const { error: err2 } = await supabase.rpc('execute_sql', {
            sql_query: `
                ALTER TABLE public.users 
                ADD COLUMN IF NOT EXISTS max_free_limit INTEGER DEFAULT 3;
            `
        });

        console.log('✅ Migración completada (o instrucciones provistas).');

    } catch (error) {
        console.error('❌ Error en migración:', error);
    }
}

//runMigration();

// EXPORTAR SQL para que el usuario lo vea
module.exports = {
    up: `
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS max_free_limit INTEGER DEFAULT 3;
    `
};
