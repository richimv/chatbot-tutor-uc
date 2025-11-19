-- stored_procedures.sql

-- =================================================================
-- 🚨 PASO 1: LIMPIEZA DE POLÍTICAS Y RESTRICCIONES
-- =================================================================
-- Se eliminan todas las políticas RLS existentes para desbloquear las tablas.
-- Se eliminan también las claves foráneas que se van a modificar.

-- Políticas de datos privados (versiones en inglés y español)
-- ✅ CORRECCIÓN: Se eliminó el punto final '.' del nombre de las políticas.
DROP POLICY IF EXISTS "Users can view their own data." ON public.users;
DROP POLICY IF EXISTS "Los usuarios pueden ver sus propios datos" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data." ON public.users;
DROP POLICY IF EXISTS "Los usuarios pueden actualizar sus propios datos" ON public.users;
DROP POLICY IF EXISTS "Users can manage their own conversations." ON public.conversations;
DROP POLICY IF EXISTS "Los usuarios pueden gestionar sus propias conversaciones" ON public.conversations;
DROP POLICY IF EXISTS "Users can manage messages in their own conversations." ON public.chat_messages;
DROP POLICY IF EXISTS "Los usuarios pueden gestionar mensajes en sus propias conversaciones" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can create and view their own feedback." ON public.feedback;
DROP POLICY IF EXISTS "Los usuarios pueden crear y ver su propio feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can create and view their own search history." ON public.search_history;
DROP POLICY IF EXISTS "Los usuarios pueden crear y ver su propio historial de búsqueda" ON public.search_history;

-- Políticas de datos públicos (versiones en inglés y español)
-- ✅ SOLUCIÓN: Estandarizar el nombre de la política para 'careers'.
DROP POLICY IF EXISTS "Public careers are viewable by everyone." ON public.careers;
DROP POLICY IF EXISTS "Los datos públicos son visibles para todos" ON public.careers;
DROP POLICY IF EXISTS "Public data is viewable by everyone." ON public.courses;
DROP POLICY IF EXISTS "Los datos públicos son visibles para todos" ON public.courses;
DROP POLICY IF EXISTS "Public data is viewable by everyone." ON public.topics;
DROP POLICY IF EXISTS "Los datos públicos son visibles para todos" ON public.topics;
DROP POLICY IF EXISTS "Public data is viewable by everyone." ON public.resources;
DROP POLICY IF EXISTS "Los datos públicos son visibles para todos" ON public.resources;
DROP POLICY IF EXISTS "Public data is viewable by everyone." ON public.sections;
DROP POLICY IF EXISTS "Los datos públicos son visibles para todos" ON public.sections;
DROP POLICY IF EXISTS "Public data is viewable by everyone." ON public.course_topics;
DROP POLICY IF EXISTS "Public data is viewable by everyone." ON public.course_books;
DROP POLICY IF EXISTS "Public data is viewable by everyone." ON public.section_careers;
DROP POLICY IF EXISTS "Public data is viewable by everyone." ON public.topic_resources;

-- Eliminar claves foráneas que dependen de 'users.id'
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_user_id_fkey;
ALTER TABLE public.search_history DROP CONSTRAINT IF EXISTS search_history_user_id_fkey;
ALTER TABLE public.sections DROP CONSTRAINT IF EXISTS sections_instructor_id_fkey;

-- =================================================================
-- ⚙️ SECCIÓN DE MIGRACIÓN DE ESQUEMA (EJECUTAR UNA SOLA VEZ)
-- =================================================================
-- ✅ SOLUCIÓN DEFINITIVA: Migración de IDs de INTEGER a UUID
-- Este bloque reemplaza los IDs numéricos por los UUIDs correctos de `auth.users`.

-- 1. Añadir columnas temporales para los nuevos UUIDs
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS uuid_id UUID;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user_uuid_id UUID;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS user_uuid_id UUID;
ALTER TABLE public.search_history ADD COLUMN IF NOT EXISTS user_uuid_id UUID;
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS instructor_uuid_id UUID;

-- 2. Poblar las columnas temporales uniendo por email y por el ID antiguo
UPDATE public.users u SET uuid_id = au.id FROM auth.users au WHERE u.email = au.email;
UPDATE public.conversations c SET user_uuid_id = u.uuid_id FROM public.users u WHERE c.user_id = u.id;
UPDATE public.feedback f SET user_uuid_id = u.uuid_id FROM public.users u WHERE f.user_id = u.id;
UPDATE public.search_history sh SET user_uuid_id = u.uuid_id FROM public.users u WHERE sh.user_id = u.id;
UPDATE public.sections s SET instructor_uuid_id = u.uuid_id FROM public.users u WHERE s.instructor_id = u.id;


-- 2.5. ✅ SOLUCIÓN: Limpiar registros huérfanos
-- Eliminar datos dependientes de usuarios que no existen en `auth.users` (y por tanto tienen uuid_id nulo).
-- Se usa el ID numérico antiguo (que aún existe en esta fase) para la limpieza.
DELETE FROM public.conversations WHERE user_id IN (SELECT id FROM public.users WHERE uuid_id IS NULL);
DELETE FROM public.feedback WHERE user_id IN (SELECT id FROM public.users WHERE uuid_id IS NULL);
DELETE FROM public.search_history WHERE user_id IN (SELECT id FROM public.users WHERE uuid_id IS NULL);
-- Para los instructores, es más seguro poner su ID a NULL que borrar la sección entera.
UPDATE public.sections SET instructor_id = NULL WHERE instructor_id IN (SELECT id FROM public.users WHERE uuid_id IS NULL);

-- Ahora, eliminar los usuarios huérfanos de la tabla principal.
DELETE FROM public.users WHERE uuid_id IS NULL;

-- 3. Eliminar las columnas antiguas de tipo INTEGER
ALTER TABLE public.conversations DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.feedback DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.search_history DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.sections DROP COLUMN IF EXISTS instructor_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS id;

-- 4. Renombrar las nuevas columnas UUID a sus nombres finales
ALTER TABLE public.users RENAME COLUMN uuid_id TO id;
ALTER TABLE public.conversations RENAME COLUMN user_uuid_id TO user_id;
ALTER TABLE public.feedback RENAME COLUMN user_uuid_id TO user_id;
ALTER TABLE public.search_history RENAME COLUMN user_uuid_id TO user_id;
ALTER TABLE public.sections RENAME COLUMN instructor_uuid_id TO instructor_id;

-- 5. Establecer la nueva columna 'id' como clave primaria en 'users'
ALTER TABLE public.users ADD PRIMARY KEY (id);

-- 6. Re-establecer las claves foráneas, ahora apuntando a la nueva columna UUID
ALTER TABLE public.conversations ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.search_history ADD CONSTRAINT search_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.sections ADD CONSTRAINT sections_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- =================================================================
-- ✅ SECCIÓN DE SEGURIDAD: RLS Y POLÍTICAS
-- =================================================================

-- Habilitar RLS en todas las tablas públicas
-- Esto bloquea el acceso por defecto. Nadie podrá hacer nada hasta que definamos las políticas.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.careers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
-- Tablas de unión
ALTER TABLE public.course_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_careers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_resources ENABLE ROW LEVEL SECURITY;

-- ✅ NUEVO: Tabla para registrar vistas de página (analítica de interés)
CREATE TABLE IF NOT EXISTS public.page_views (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'course', 'topic', 'career'
    entity_id INTEGER NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
-- Política: Cualquier usuario autenticado puede registrar una vista.
CREATE POLICY "Authenticated users can insert page views" ON public.page_views FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas para datos de solo lectura (públicos para usuarios autenticados)

-- Cualquiera que haya iniciado sesión ('authenticated') puede LEER (SELECT) esta información.
-- Nadie puede modificarla directamente (no hay políticas de INSERT, UPDATE, DELETE).
-- El rol 'service_role' (usado por el backend de Node.js) se salta RLS, por lo que el panel de admin seguirá funcionando.

CREATE POLICY "Public careers are viewable by everyone." ON public.careers FOR SELECT USING (true);
CREATE POLICY "Public data is viewable by everyone." ON public.courses FOR SELECT USING (true);
CREATE POLICY "Public data is viewable by everyone." ON public.topics FOR SELECT USING (true);
CREATE POLICY "Public data is viewable by everyone." ON public.resources FOR SELECT USING (true);
CREATE POLICY "Public data is viewable by everyone." ON public.sections FOR SELECT USING (true);
-- Tablas de unión también deben ser legibles
CREATE POLICY "Public data is viewable by everyone." ON public.course_topics FOR SELECT USING (true);
CREATE POLICY "Public data is viewable by everyone." ON public.course_books FOR SELECT USING (true);
CREATE POLICY "Public data is viewable by everyone." ON public.section_careers FOR SELECT USING (true);
CREATE POLICY "Public data is viewable by everyone." ON public.topic_resources FOR SELECT USING (true);

-- Políticas para datos privados (pertenecen a un usuario)
-- Tabla 'users': Un usuario solo puede ver y actualizar su propia información.
CREATE POLICY "Users can view their own data." ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own data." ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Tabla 'conversations': Un usuario puede gestionar completamente sus propias conversaciones.
CREATE POLICY "Users can manage their own conversations." ON public.conversations FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Tabla 'chat_messages': Un usuario puede gestionar mensajes de sus propias conversaciones.
CREATE POLICY "Users can manage messages in their own conversations." ON public.chat_messages FOR ALL
    USING ((SELECT user_id FROM conversations WHERE id = conversation_id) = auth.uid())
    WITH CHECK ((SELECT user_id FROM conversations WHERE id = conversation_id) = auth.uid());

-- Tabla 'feedback': Un usuario puede crear feedback y ver el suyo.
CREATE POLICY "Users can create and view their own feedback." ON public.feedback FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Tabla 'search_history': Un usuario puede crear y ver su propio historial de búsqueda.
CREATE POLICY "Users can create and view their own search history." ON public.search_history FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- =================================================================
-- ✅ SECCIÓN DE OPTIMIZACIÓN Y FUNCIONES
-- =================================================================

-- --- 4. Mover extensiones a un esquema dedicado ---
-- Esto es una buena práctica para mantener el esquema 'public' limpio.
CREATE SCHEMA IF NOT EXISTS extensions;

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
-- Esta extensión permite crear índices GIN, que aceleran drásticamente las consultas con LIKE/ILIKE.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
-- Habilitar la extensión para Levenshtein (búsqueda por similitud)
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA extensions;

-- ✅ CORRECCIÓN: Crear una función "wrapper" inmutable para `unaccent`.
-- PostgreSQL requiere que las funciones usadas en índices sean IMMUTABLE. La función `unaccent` por defecto
-- es STABLE. Este wrapper nos permite usarla en un índice de forma segura.
-- ✅ SEGURIDAD: Añadir SET search_path para evitar vulnerabilidades.
CREATE OR REPLACE FUNCTION f_unaccent(text)
RETURNS text AS
$func$
-- ✅ CORRECCIÓN FINAL: Usar la versión de un solo argumento de unaccent, que es más estándar y robusta.
SELECT public.unaccent($1)
$func$ LANGUAGE sql IMMUTABLE;

-- ✅ OPTIMIZACIÓN: Crear índices GIN en las columnas de texto que se usan para la búsqueda.
-- Ahora usamos nuestra función inmutable `f_unaccent` para que PostgreSQL permita la creación del índice.
CREATE INDEX IF NOT EXISTS idx_courses_name_trgm ON courses USING gin (f_unaccent(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_topics_name_trgm ON topics USING gin (f_unaccent(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin (f_unaccent(name) gin_trgm_ops);


-- Procedimiento Almacenado para obtener todos los cursos con sus detalles agregados.
-- Este procedimiento reemplaza la lógica que estaba en `courseRepository.findAll()`.

-- Usamos CREATE OR REPLACE FUNCTION para poder actualizar la función fácilmente en el futuro.
-- ✅ SEGURIDAD: Añadir SET search_path.
-- RETURNS TABLE define la estructura exacta de la tabla que devolverá la función.
CREATE OR REPLACE FUNCTION get_all_courses_with_details()
RETURNS TABLE(
    id INT,
    course_id VARCHAR,
    name VARCHAR,
    description TEXT,
    "topicIds" INT[],
    "bookIds" INT[],
    "careerIds" INT[]
) AS $$
BEGIN
    -- La palabra clave RETURN QUERY ejecuta la consulta y devuelve sus resultados
    -- con el formato definido en RETURNS TABLE.
    RETURN QUERY
    SELECT 
        c.id,
        c.course_id,
        c.name,
        c.description,
        (SELECT COALESCE(ARRAY_AGG(ct.topic_id), '{}') FROM course_topics ct WHERE ct.course_id = c.id) as "topicIds",
        (SELECT COALESCE(ARRAY_AGG(cb.resource_id), '{}') FROM course_books cb WHERE cb.course_id = c.id) as "bookIds",
        (SELECT COALESCE(ARRAY_AGG(DISTINCT sc.career_id), '{}') FROM sections s JOIN section_careers sc ON s.id = sc.section_id WHERE s.course_id = c.id) as "careerIds"
    FROM 
        courses c
    GROUP BY 
        c.id
    ORDER BY 
        c.name;
END; 
$$ LANGUAGE plpgsql SET search_path = 'public';

-- Procedimiento Almacenado para la búsqueda principal de cursos.
-- Reemplaza la lógica que estaba en `courseRepository.search()`.
-- ✅ SEGURIDAD: Añadir SET search_path.
-- Acepta un parámetro de entrada `p_search_term` para el término de búsqueda.
CREATE OR REPLACE FUNCTION search_courses(p_search_term TEXT)
RETURNS TABLE(
    id INT,
    name VARCHAR,
    description TEXT,
    "topicIds" INT[],
    "bookIds" INT[],
    "careerIds" JSON
) AS $$
DECLARE
    full_search_term TEXT;
    search_terms TEXT[];
BEGIN
    full_search_term := '%' || p_search_term || '%';
    search_terms := ARRAY(SELECT '%' || term || '%' FROM unnest(string_to_array(p_search_term, ' ')) AS term WHERE term <> '');

    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.description,
        (SELECT COALESCE(ARRAY_AGG(ct.topic_id), '{}') FROM course_topics ct WHERE ct.course_id = c.id) as "topicIds",
        (SELECT COALESCE(ARRAY_AGG(cb.resource_id), '{}') FROM course_books cb WHERE cb.course_id = c.id) as "bookIds",
        (SELECT COALESCE(json_agg(json_build_object('id', car.id, 'name', car.name)), '[]'::json)
         FROM (SELECT DISTINCT car_data.id, car_data.name FROM sections s_inner JOIN section_careers sc_inner ON s_inner.id = sc_inner.section_id JOIN careers car_data ON sc_inner.career_id = car_data.id WHERE s_inner.course_id = c.id) car) as "careerIds"
    FROM courses c
    WHERE c.id IN (
        -- ✅ CORRECCIÓN DEFINITIVA: La subconsulta de docentes ahora es correcta y eficiente.
        -- Busca los IDs de los docentes que coinciden y luego obtiene los IDs de los cursos que imparten.
        SELECT s.course_id
        FROM sections s
        WHERE s.instructor_id IN (
            -- ✅ MEJORA: Se busca que el nombre del docente contenga el término de búsqueda completo.
            SELECT u.id FROM users u WHERE u.role = 'instructor' AND f_unaccent(u.name) ILIKE f_unaccent(full_search_term)
        )
        UNION -- Unir con los resultados de búsqueda por nombre de tema.
        SELECT ct.course_id
        FROM course_topics ct JOIN topics t ON ct.topic_id = t.id
        WHERE f_unaccent(t.name) ILIKE f_unaccent(full_search_term)
        UNION -- Unir con los resultados de búsqueda por nombre de curso.
        SELECT c_inner.id
        FROM courses c_inner
        WHERE f_unaccent(c_inner.name) ILIKE f_unaccent(full_search_term)
    )
    ORDER BY c.name;
END; 
$$ LANGUAGE plpgsql SET search_path = 'public';

-- Se elimina la función find_courses_by_instructor ya que su lógica se ha integrado
-- de forma correcta y robusta en la función principal search_courses. Esto simplifica el código.

-- ✅ CORRECCIÓN: Eliminar explícitamente la función antes de recrearla.
-- Esto es necesario porque la nueva versión cambia la estructura de las columnas que devuelve (el "return type"),
-- y PostgreSQL requiere un DROP/CREATE explícito para este tipo de modificación.
DROP FUNCTION IF EXISTS find_courses_by_career_category(TEXT);

-- Procedimiento Almacenado para buscar cursos por categoría de carrera (con tolerancia a errores).
-- Reemplaza la lógica que estaba en `courseRepository.findByCareerCategory()`.
-- ✅ SEGURIDAD: Añadir SET search_path.
-- Acepta un parámetro de entrada `p_category_name` para el nombre de la carrera.
CREATE OR REPLACE FUNCTION find_courses_by_career_category(p_category_name TEXT)
RETURNS TABLE(
    -- ✅ CORRECCIÓN: La definición de retorno ahora coincide con las columnas en el SELECT.
    id INT,
    course_id VARCHAR,
    name VARCHAR,
    description TEXT,
    "topicIds" INT[],
    "bookIds" INT[],
    "careerIds" JSON,
    relevance_score BIGINT
) AS $$
DECLARE
    -- Variable para el patrón de búsqueda LIKE
    like_pattern TEXT;
BEGIN
    like_pattern := '%' || p_category_name || '%';

    RETURN QUERY
    SELECT 
        c.id,
        c.course_id,
        c.name,
        c.description,
        (SELECT COALESCE(ARRAY_AGG(ct.topic_id), '{}') FROM course_topics ct WHERE ct.course_id = c.id) as "topicIds",
        (SELECT COALESCE(ARRAY_AGG(cb.resource_id), '{}') FROM course_books cb WHERE cb.course_id = c.id) as "bookIds",
        (SELECT COALESCE(json_agg(json_build_object('id', car_inner.id, 'name', car_inner.name)), '[]'::json)
         FROM (SELECT DISTINCT car_data.id, car_data.name FROM sections s_inner JOIN section_careers sc_inner ON s_inner.id = sc_inner.section_id JOIN careers car_data ON sc_inner.career_id = car_data.id WHERE s_inner.course_id = c.id) car_inner) as "careerIds",
        MIN(car.relevance_score)::BIGINT as relevance_score
    FROM courses c
    INNER JOIN (
        -- ✅ MEJORA: La comparación de Levenshtein ahora se hace contra la PRIMERA PALABRA de la carrera.
        -- Esto permite que "ingenieriaa" coincida con "Ingeniería de Software" porque compara 'ingenieriaa' con 'ingenieria'.
        -- Usamos f_unaccent para consistencia y potencial uso de índices.
        SELECT DISTINCT s.course_id, MIN(levenshtein(lower(f_unaccent(split_part(car.name, ' ', 1))), lower(f_unaccent(p_category_name)))) as relevance_score
        FROM sections s
        INNER JOIN section_careers sc ON s.id = sc.section_id
        INNER JOIN careers car ON sc.career_id = car.id
        WHERE 
            levenshtein(lower(f_unaccent(split_part(car.name, ' ', 1))), lower(f_unaccent(p_category_name))) < 4 
            OR f_unaccent(lower(car.name)) LIKE f_unaccent(lower(like_pattern))
        GROUP BY s.course_id
    ) as car ON c.id = car.course_id
    GROUP BY c.id
    -- ✅ MEJORA: Ordenar por la puntuación de relevancia para mostrar primero las mejores coincidencias.
    ORDER BY MIN(car.relevance_score) ASC, c.name ASC;
END; 
$$ LANGUAGE plpgsql SET search_path = 'public';