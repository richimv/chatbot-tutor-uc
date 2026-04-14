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
    -- Realizamos un UPSERT: 
    -- 1. Si el correo ya existe, actualizamos el registro (Vinculación de cuenta/ID)
    -- 2. Si es nuevo, insertamos.
    RETURN QUERY
    INSERT INTO public.users (
        id, name, email, password_hash, role, 
        subscription_status, subscription_tier, 
        usage_count, max_free_limit, last_usage_reset, 
        created_at, updated_at
    ) 
    VALUES (
        p_id, p_name, lower(p_email), p_password_hash, p_role, 
        'pending', 'free', 0, 50, CURRENT_DATE, NOW(), NOW()
    )
    ON CONFLICT (email) 
    DO UPDATE SET
        id = EXCLUDED.id, -- Importante: Sincronizar el ID de Supabase
        name = EXCLUDED.name,
        updated_at = NOW()
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
