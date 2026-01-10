-- Migración: 006_sync_google_users.sql
-- Objetivo: Sincronizar usuarios creados por Google Auth (auth.users) hacia nuestra tabla de negocio (public.users)

-- 1. Crear la función que maneja el evento de nuevo usuario
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (
    id, 
    email, 
    name, 
    role, 
    subscription_status, 
    usage_count, 
    max_free_limit,
    created_at
  )
  VALUES (
    new.id,
    new.email,
    -- Intentar obtener el nombre completo de los metadatos de Google, o usar la parte local del email
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'student',
    'pending',
    0,
    3,
    NOW()
  )
  -- Si el usuario ya existe (por alguna razón rara), no hacer nada para evitar errores
  ON CONFLICT (id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear el Trigger que se dispara después de un INSERT en auth.users
-- Primero lo borramos si existe para evitar duplicados
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Nota: Esto automágicamente copiará cualquier usuario que se registre con Google (o correo)
-- a tu tabla public.users con los valores por defecto requeridos.
