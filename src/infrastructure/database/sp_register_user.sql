-- sp_register_user.sql
-- Procedimiento robusto para registrar o sincronizar usuarios desde Supabase Auth.
-- Soporta correos institucionales y asegura que no haya duplicados por ID.

CREATE OR REPLACE FUNCTION sp_register_user(
    p_id UUID,
    p_name TEXT,
    p_email TEXT,
    p_password_hash TEXT,
    p_role TEXT DEFAULT 'student',
    p_avatar_url TEXT DEFAULT NULL
)
RETURNS SETOF public.users AS $$
BEGIN
    -- Realizamos un UPSERT atómico: 
    -- 1. Si el correo ya existe, sincronizamos el ID, avatar y actualizamos timestamp.
    -- 2. Si es nuevo, insertamos el registro.
    RETURN QUERY
    INSERT INTO public.users (
        id, name, email, password_hash, role, avatar_url,
        subscription_status, subscription_tier, 
        usage_count, max_free_limit, last_usage_reset, 
        last_free_renewal, created_at, updated_at
    ) 
    VALUES (
        p_id, p_name, lower(p_email), p_password_hash, p_role, p_avatar_url,
        'pending', 'free', 0, 10, CURRENT_DATE, NOW(), NOW(), NOW()
    )
    ON CONFLICT (email) 
    DO UPDATE SET
        id = EXCLUDED.id, -- Sincronizar el ID de Supabase Auth
        name = EXCLUDED.name,
        role = CASE 
            WHEN EXCLUDED.role = 'admin' THEN 'admin'
            ELSE public.users.role
        END,
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
        updated_at = NOW()
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.sp_register_user(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
