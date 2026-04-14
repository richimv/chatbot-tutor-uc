-- sp_register_user.sql
-- Procedimiento robusto para registrar o sincronizar usuarios desde Supabase Auth.
-- Soporta correos institucionales y asegura que no haya duplicados por ID.

CREATE OR REPLACE FUNCTION sp_register_user(
    p_id UUID,
    p_name VARCHAR,
    p_email VARCHAR,
    p_password_hash TEXT,
    p_role VARCHAR DEFAULT 'student'
)
RETURNS SETOF public.users AS $$
BEGIN
    -- Realizamos un UPSERT: Insertar si no existe, o actualizar si el ID ya está presente.
    RETURN QUERY
    INSERT INTO public.users (
        id, 
        name, 
        email, 
        password_hash, 
        role, 
        subscription_status, 
        subscription_tier, 
        usage_count, 
        max_free_limit,
        last_usage_reset,
        created_at,
        updated_at
    ) 
    VALUES (
        p_id, 
        p_name, 
        lower(p_email), 
        p_password_hash, 
        p_role, 
        'pending', -- ✅ CORRECCIÓN: Por defecto 'pending' hasta que paguen.
        'free',    -- Nivel gratuito inicial
        0, 
        50,        -- Límite gratuito (según database_schema)
        CURRENT_DATE, -- Inicialización de reset diario
        NOW(), 
        NOW()
    )
    ON CONFLICT (id) 
    DO UPDATE SET
        name = EXCLUDED.name,
        email = lower(EXCLUDED.email),
        updated_at = NOW()
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
