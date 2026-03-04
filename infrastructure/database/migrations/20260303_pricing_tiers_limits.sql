-- Migration: Update Users Table for Pricing Tiers and Usage Limits
-- This migration adds the necessary columns to track daily and monthly usage for the new pricing strategy (Basic & Advanced).

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free',
    ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS daily_ai_usage INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS monthly_thinking_usage INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS daily_arena_usage INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_usage_reset DATE;

-- Explicación de las nuevas columnas:
-- subscription_tier: 'free', 'basic', 'advanced'
-- subscription_expires_at: Fecha en que expira el plan.
-- daily_ai_usage: Contador de mensajes de chat estándar usados HOY.
-- monthly_thinking_usage: Contador de mensajes 'Thinking' usados en el MES ACTIVO del plan.
-- daily_arena_usage: Juegos de Arena usados HOY.
-- last_usage_reset: Se usa en el código para saber si ya cambiamos de día y debemos resetear los daily a 0.
