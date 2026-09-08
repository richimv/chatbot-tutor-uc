-- ==============================================================================
-- HUB ACADEMIA - MASTER PRODUCTION DATABASE SCHEMA (SUPABASE POSTGRESQL 15+)
-- Synchronized directly from live Supabase PostgreSQL Instance
-- Updated: 2026-08-20
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA vault;
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA extensions;

-- ------------------------------------------------------------------------------
-- 2. CUSTOM TYPES & ENUMS
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'aal_level') THEN
        CREATE TYPE auth.aal_level AS ENUM ('aal1', 'aal2', 'aal3');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'academic_area') THEN
        CREATE TYPE public.academic_area AS ENUM ('Ciencias de la Salud', 'Ingenierías', 'Ciencias Empresariales', 'Ciencias Sociales y Humanidades', 'Arquitectura y Diseño', 'Ciencias Exactas');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action') THEN
        CREATE TYPE realtime.action AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'ERROR');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'buckettype') THEN
        CREATE TYPE storage.buckettype AS ENUM ('STANDARD', 'ANALYTICS', 'VECTOR');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'code_challenge_method') THEN
        CREATE TYPE auth.code_challenge_method AS ENUM ('s256', 'plain');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equality_op') THEN
        CREATE TYPE realtime.equality_op AS ENUM ('eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'like', 'ilike', 'is', 'match', 'imatch', 'isdistinct');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factor_status') THEN
        CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factor_type') THEN
        CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'oauth_authorization_status') THEN
        CREATE TYPE auth.oauth_authorization_status AS ENUM ('pending', 'approved', 'denied', 'expired');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'oauth_client_type') THEN
        CREATE TYPE auth.oauth_client_type AS ENUM ('public', 'confidential');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'oauth_registration_type') THEN
        CREATE TYPE auth.oauth_registration_type AS ENUM ('dynamic', 'manual');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'oauth_response_type') THEN
        CREATE TYPE auth.oauth_response_type AS ENUM ('code');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'one_time_token_type') THEN
        CREATE TYPE auth.one_time_token_type AS ENUM ('confirmation_token', 'reauthentication_token', 'recovery_token', 'email_change_token_new', 'email_change_token_current', 'phone_change_token');
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. TABLES DEFINITIONS & PRIMARY KEYS
-- ------------------------------------------------------------------------------

-- Table: public.careers
CREATE TABLE IF NOT EXISTS public.careers (
    id INTEGER DEFAULT nextval('careers_id_seq'::regclass) NOT NULL,
    career_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    area academic_area NOT NULL,
    image_url TEXT,
    domain VARCHAR(50) DEFAULT 'medicine'::character varying,
    CONSTRAINT careers_pkey PRIMARY KEY (id)
);

-- Table: public.course_books
CREATE TABLE IF NOT EXISTS public.course_books (
    course_id INTEGER NOT NULL,
    resource_id INTEGER NOT NULL,
    CONSTRAINT course_books_pkey PRIMARY KEY (course_id, resource_id)
);

-- Table: public.course_careers
CREATE TABLE IF NOT EXISTS public.course_careers (
    course_id INTEGER NOT NULL,
    career_id INTEGER NOT NULL,
    CONSTRAINT course_careers_pkey PRIMARY KEY (course_id, career_id)
);

-- Table: public.course_topics
CREATE TABLE IF NOT EXISTS public.course_topics (
    course_id INTEGER NOT NULL,
    topic_id INTEGER NOT NULL,
    unit_name VARCHAR(255) DEFAULT 'General'::character varying,
    CONSTRAINT course_topics_pkey PRIMARY KEY (course_id, topic_id)
);

-- Table: public.courses
CREATE TABLE IF NOT EXISTS public.courses (
    id INTEGER DEFAULT nextval('courses_id_seq'::regclass) NOT NULL,
    course_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    image_url TEXT,
    domain VARCHAR(50) DEFAULT 'medicine'::character varying,
    CONSTRAINT courses_pkey PRIMARY KEY (id)
);

-- Table: public.decks
CREATE TABLE IF NOT EXISTS public.decks (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) DEFAULT 'USER'::character varying,
    source_module VARCHAR(50) DEFAULT 'MANUAL'::character varying,
    icon VARCHAR(50) DEFAULT '📚'::character varying,
    created_at TIMESTAMPTZ DEFAULT now(),
    parent_id UUID,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    cloned_from_id INTEGER,
    likes_count INTEGER DEFAULT 0,
    saves_count INTEGER DEFAULT 0,
    color VARCHAR(50) DEFAULT NULL::character varying,
    category VARCHAR(50) DEFAULT 'General'::character varying,
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT decks_pkey PRIMARY KEY (id)
);

-- Table: public.page_views
CREATE TABLE IF NOT EXISTS public.page_views (
    id BIGINT DEFAULT nextval('page_views_id_seq'::regclass) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT page_views_pkey PRIMARY KEY (id)
);

-- Table: public.payment_events
CREATE TABLE IF NOT EXISTS public.payment_events (
    payment_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    plan_id TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    status TEXT DEFAULT 'processing'::text NOT NULL,
    received_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    CONSTRAINT payment_events_status_check CHECK (status = ANY (ARRAY['processing'::text, 'processed'::text, 'failed'::text]))
);

-- Table: public.case_scenarios
CREATE TABLE IF NOT EXISTS public.case_scenarios (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    code VARCHAR(100) UNIQUE,
    title VARCHAR(255),
    description_text TEXT DEFAULT ''::text,
    image_url TEXT,
    domain VARCHAR(50) DEFAULT 'education'::character varying,
    target VARCHAR(100),
    topic VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT case_scenarios_pkey PRIMARY KEY (id)
);

-- Table: public.question_bank
CREATE TABLE IF NOT EXISTS public.question_bank (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    domain VARCHAR(255) DEFAULT 'GENERAL'::character varying,
    topic VARCHAR(100) NOT NULL,
    difficulty VARCHAR(50) DEFAULT 'Senior'::character varying,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_option_index INTEGER NOT NULL,
    explanation TEXT,
    times_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    question_hash TEXT,
    image_url TEXT,
    target VARCHAR(255),
    career VARCHAR(100),
    subtopic VARCHAR(255),
    explanation_image_url TEXT,
    case_id UUID REFERENCES public.case_scenarios(id) ON DELETE SET NULL,
    case_order INTEGER DEFAULT 1,
    CONSTRAINT question_bank_pkey PRIMARY KEY (id)
);

-- Table: public.quiz_history
CREATE TABLE IF NOT EXISTS public.quiz_history (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    user_id UUID NOT NULL,
    topic VARCHAR(100) NOT NULL,
    difficulty VARCHAR(20) DEFAULT 'ENAM'::character varying,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    weak_points text[],
    created_at TIMESTAMPTZ DEFAULT now(),
    area_stats JSONB DEFAULT '{}'::jsonb,
    target VARCHAR(50),
    career VARCHAR(100),
    source_session_id UUID,
    CONSTRAINT quiz_history_pkey PRIMARY KEY (id)
);

-- Tables: server-authoritative simulator sessions
CREATE TABLE IF NOT EXISTS public.quiz_sessions (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID,
    domain VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours') NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    quiz_history_id UUID,
    CONSTRAINT quiz_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT quiz_sessions_domain_check CHECK (domain IN ('medicine', 'education')),
    CONSTRAINT quiz_sessions_status_check CHECK (status IN ('active', 'completed', 'submitted')),
    CONSTRAINT quiz_sessions_history_id_fkey FOREIGN KEY (quiz_history_id) REFERENCES public.quiz_history(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.quiz_session_questions (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    session_id UUID NOT NULL,
    bank_question_id UUID,
    position INTEGER NOT NULL,
    public_payload JSONB NOT NULL,
    answer_payload JSONB NOT NULL,
    selected_option_index INTEGER,
    is_correct BOOLEAN,
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT quiz_session_questions_pkey PRIMARY KEY (id),
    CONSTRAINT quiz_session_questions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
    CONSTRAINT quiz_session_questions_position_unique UNIQUE (session_id, position),
    CONSTRAINT quiz_session_questions_position_check CHECK (position >= 0),
    CONSTRAINT quiz_session_questions_answer_consistency CHECK (
        (selected_option_index IS NULL AND is_correct IS NULL AND answered_at IS NULL)
        OR
        (selected_option_index IS NOT NULL AND is_correct IS NOT NULL AND answered_at IS NOT NULL)
    )
);

-- Table: public.resources
CREATE TABLE IF NOT EXISTS public.resources (
    id INTEGER DEFAULT nextval('resources_id_seq'::regclass) NOT NULL,
    resource_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    url VARCHAR(255),
    image_url VARCHAR(500),
    resource_type VARCHAR(50) DEFAULT 'book'::character varying,
    is_premium BOOLEAN DEFAULT false,
    content_html TEXT,
    domain VARCHAR(50) DEFAULT 'medicine'::character varying,
    visible BOOLEAN DEFAULT true,
    open_directly BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT resources_pkey PRIMARY KEY (id)
);

-- Table: public.search_history
CREATE TABLE IF NOT EXISTS public.search_history (
    id INTEGER DEFAULT nextval('search_history_id_seq'::regclass) NOT NULL,
    query TEXT NOT NULL,
    results_count INTEGER NOT NULL,
    is_educational_query BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50) DEFAULT 'search_bar'::character varying,
    user_id UUID,
    CONSTRAINT search_history_pkey PRIMARY KEY (id)
);

-- Table: public.topic_resources
CREATE TABLE IF NOT EXISTS public.topic_resources (
    topic_id INTEGER NOT NULL,
    resource_id INTEGER NOT NULL,
    CONSTRAINT topic_resources_pkey PRIMARY KEY (topic_id, resource_id)
);

-- Table: public.topics
CREATE TABLE IF NOT EXISTS public.topics (
    id INTEGER DEFAULT nextval('topics_id_seq'::regclass) NOT NULL,
    topic_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    CONSTRAINT topics_pkey PRIMARY KEY (id)
);

-- Table: public.user_book_library
CREATE TABLE IF NOT EXISTS public.user_book_library (
    user_id UUID NOT NULL,
    book_id INTEGER NOT NULL,
    is_saved BOOLEAN DEFAULT false,
    is_favorite BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_book_library_pkey PRIMARY KEY (user_id, book_id)
);

-- Table: public.user_course_library
CREATE TABLE IF NOT EXISTS public.user_course_library (
    user_id UUID NOT NULL,
    course_id INTEGER NOT NULL,
    is_saved BOOLEAN DEFAULT false,
    is_favorite BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_course_library_pkey PRIMARY KEY (user_id, course_id)
);

-- Table: public.user_flashcards
CREATE TABLE IF NOT EXISTS public.user_flashcards (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    user_id UUID,
    front_content TEXT NOT NULL,
    back_content TEXT NOT NULL,
    topic VARCHAR(100),
    source_quiz_id UUID,
    repetition_number INTEGER DEFAULT 0,
    easiness_factor REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 0,
    last_reviewed_at TIMESTAMPTZ,
    next_review_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    deck_id UUID,
    sort_order INTEGER DEFAULT 0,
    last_quality INTEGER DEFAULT 0,
    image_url TEXT,
    explanation_image_url TEXT,
    is_template BOOLEAN DEFAULT false,
    audio_url_frente TEXT,
    audio_url_dorso TEXT,
    tts_lang_frente VARCHAR(10) DEFAULT 'es-ES'::character varying,
    tts_lang_dorso VARCHAR(10) DEFAULT 'es-ES'::character varying,
    hide_text_frente BOOLEAN DEFAULT false,
    hide_text_dorso BOOLEAN DEFAULT false,
    CONSTRAINT user_flashcards_pkey PRIMARY KEY (id)
);

-- Table: public.user_notes
CREATE TABLE IF NOT EXISTS public.user_notes (
    id BIGINT DEFAULT nextval('user_notes_id_seq'::regclass) NOT NULL,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_type TEXT DEFAULT 'manual'::text,
    source_conversation_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    color VARCHAR(50) DEFAULT NULL::character varying,
    CONSTRAINT user_notes_pkey PRIMARY KEY (id)
);

-- Table: public.user_question_history
CREATE TABLE IF NOT EXISTS public.user_question_history (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID,
    question_id UUID,
    seen_at TIMESTAMP DEFAULT now(),
    times_seen INTEGER DEFAULT 1,
    CONSTRAINT user_question_history_pkey PRIMARY KEY (id)
);

-- Table: public.user_simulator_preferences
CREATE TABLE IF NOT EXISTS public.user_simulator_preferences (
    user_id UUID NOT NULL,
    domain VARCHAR(50) NOT NULL,
    config_json JSONB DEFAULT '{}'::jsonb NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT user_simulator_preferences_pkey PRIMARY KEY (user_id, domain)
);

-- Table: public.users
CREATE TABLE IF NOT EXISTS public.users (
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT,
    role VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    id UUID NOT NULL,
    subscription_status VARCHAR(50) DEFAULT 'pending'::character varying,
    payment_id VARCHAR(255) DEFAULT NULL::character varying,
    usage_count INTEGER DEFAULT 0,
    max_free_limit INTEGER DEFAULT 50,
    updated_at TIMESTAMPTZ DEFAULT now(),
    monthly_flashcards_usage INTEGER DEFAULT 0,
    subscription_tier VARCHAR(50) DEFAULT 'free'::character varying,
    subscription_expires_at TIMESTAMPTZ,
    daily_ai_usage INTEGER DEFAULT 0,
    last_usage_reset DATE,
    daily_simulator_usage INTEGER DEFAULT 0,
    last_name_change_at TIMESTAMPTZ,
    daily_import_usage INTEGER DEFAULT 0,
    last_free_renewal TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    daily_rag_usage INTEGER DEFAULT 0,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Table: public.web_traffic
CREATE TABLE IF NOT EXISTS public.web_traffic (
    session_id UUID NOT NULL,
    user_id UUID,
    last_ping TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_mobile BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT web_traffic_pkey PRIMARY KEY (session_id)
);

-- ------------------------------------------------------------------------------
-- 4. FOREIGN KEYS & REFERENTIAL CONSTRAINTS
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_books_course_id_fkey') THEN
        ALTER TABLE public.course_books ADD CONSTRAINT course_books_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_books_resource_id_fkey') THEN
        ALTER TABLE public.course_books ADD CONSTRAINT course_books_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_careers_career_id_fkey') THEN
        ALTER TABLE public.course_careers ADD CONSTRAINT course_careers_career_id_fkey FOREIGN KEY (career_id) REFERENCES public.careers(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_careers_course_id_fkey') THEN
        ALTER TABLE public.course_careers ADD CONSTRAINT course_careers_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_topics_course_id_fkey') THEN
        ALTER TABLE public.course_topics ADD CONSTRAINT course_topics_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_topics_topic_id_fkey') THEN
        ALTER TABLE public.course_topics ADD CONSTRAINT course_topics_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'decks_parent_id_fkey') THEN
        ALTER TABLE public.decks ADD CONSTRAINT decks_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.decks(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'decks_user_id_fkey') THEN
        ALTER TABLE public.decks ADD CONSTRAINT decks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'page_views_user_id_fkey') THEN
        ALTER TABLE public.page_views ADD CONSTRAINT page_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_history_user_id_fkey') THEN
        ALTER TABLE public.quiz_history ADD CONSTRAINT quiz_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_sessions_user_id_fkey') THEN
        ALTER TABLE public.quiz_sessions ADD CONSTRAINT quiz_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'search_history_user_id_fkey') THEN
        ALTER TABLE public.search_history ADD CONSTRAINT search_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'topic_resources_resource_id_fkey') THEN
        ALTER TABLE public.topic_resources ADD CONSTRAINT topic_resources_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'topic_resources_topic_id_fkey') THEN
        ALTER TABLE public.topic_resources ADD CONSTRAINT topic_resources_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_book_library_book_id_fkey') THEN
        ALTER TABLE public.user_book_library ADD CONSTRAINT user_book_library_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.resources(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_book_library_user_id_fkey') THEN
        ALTER TABLE public.user_book_library ADD CONSTRAINT user_book_library_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_course_library_course_id_fkey') THEN
        ALTER TABLE public.user_course_library ADD CONSTRAINT user_course_library_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_course_library_user_id_fkey') THEN
        ALTER TABLE public.user_course_library ADD CONSTRAINT user_course_library_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_flashcards_deck_id_fkey') THEN
        ALTER TABLE public.user_flashcards ADD CONSTRAINT user_flashcards_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES public.decks(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_flashcards_user_id_fkey') THEN
        ALTER TABLE public.user_flashcards ADD CONSTRAINT user_flashcards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_question_history_question_id_fkey') THEN
        ALTER TABLE public.user_question_history ADD CONSTRAINT user_question_history_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question_bank(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_question_history_user_id_fkey') THEN
        ALTER TABLE public.user_question_history ADD CONSTRAINT user_question_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_simulator_preferences_user_id_fkey') THEN
        ALTER TABLE public.user_simulator_preferences ADD CONSTRAINT user_simulator_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'web_traffic_user_id_fkey') THEN
        ALTER TABLE public.web_traffic ADD CONSTRAINT web_traffic_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.careers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_careers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_session_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_book_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_course_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_question_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_simulator_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_traffic ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Careers" ON public.careers;
CREATE POLICY "Public Read Careers" ON public.careers
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Public careers are viewable by everyone." ON public.careers;
CREATE POLICY "Public careers are viewable by everyone." ON public.careers
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Public Read Course Books" ON public.course_books;
CREATE POLICY "Public Read Course Books" ON public.course_books
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Public data is viewable by everyone." ON public.course_books;
CREATE POLICY "Public data is viewable by everyone." ON public.course_books
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Public Read Course Careers" ON public.course_careers;
CREATE POLICY "Public Read Course Careers" ON public.course_careers
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Public read access for course_careers" ON public.course_careers;
CREATE POLICY "Public read access for course_careers" ON public.course_careers
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Public read course_careers" ON public.course_careers;
CREATE POLICY "Public read course_careers" ON public.course_careers
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Public Read Course Topics" ON public.course_topics;
CREATE POLICY "Public Read Course Topics" ON public.course_topics
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Public data is viewable by everyone." ON public.course_topics;
CREATE POLICY "Public data is viewable by everyone." ON public.course_topics
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Public Read Courses" ON public.courses;
CREATE POLICY "Public Read Courses" ON public.courses
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Public data is viewable by everyone." ON public.courses;
CREATE POLICY "Public data is viewable by everyone." ON public.courses
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Users manage own decks" ON public.decks;
CREATE POLICY "Users manage own decks" ON public.decks
    AS PERMISSIVE
    FOR ALL
    TO public
    USING ((auth.uid() = user_id))
;

-- Question bank is intentionally not readable through PostgREST. The answer
-- key (correct_option_index) is served only by protected server-side flows.
DROP POLICY IF EXISTS "Public Read Question Bank" ON public.question_bank;
DROP POLICY IF EXISTS "Public Read Questions" ON public.question_bank;
REVOKE SELECT ON TABLE public.question_bank FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.payment_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.quiz_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.quiz_session_questions FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Users insert own history" ON public.quiz_history;
CREATE POLICY "Users insert own history" ON public.quiz_history
    AS PERMISSIVE
    FOR INSERT
    TO public
    WITH CHECK ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users view own history" ON public.quiz_history;
CREATE POLICY "Users view own history" ON public.quiz_history
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Public Read Resources" ON public.resources;
CREATE POLICY "Public Read Resources" ON public.resources
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Public data is viewable by everyone." ON public.resources;
CREATE POLICY "Public data is viewable by everyone." ON public.resources
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Users can create and view their own search history." ON public.search_history;
CREATE POLICY "Users can create and view their own search history." ON public.search_history
    AS PERMISSIVE
    FOR ALL
    TO public
    USING ((auth.uid() = user_id))
    WITH CHECK ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can manage own search history" ON public.search_history;
CREATE POLICY "Users can manage own search history" ON public.search_history
    AS PERMISSIVE
    FOR ALL
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Public Read Topic Resources" ON public.topic_resources;
CREATE POLICY "Public Read Topic Resources" ON public.topic_resources
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Public read access for topic_resources" ON public.topic_resources;
CREATE POLICY "Public read access for topic_resources" ON public.topic_resources
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Public read topic_resources" ON public.topic_resources;
CREATE POLICY "Public read topic_resources" ON public.topic_resources
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Public Read Topics" ON public.topics;
CREATE POLICY "Public Read Topics" ON public.topics
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Public data is viewable by everyone." ON public.topics;
CREATE POLICY "Public data is viewable by everyone." ON public.topics
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

DROP POLICY IF EXISTS "Users can delete from their own book library" ON public.user_book_library;
CREATE POLICY "Users can delete from their own book library" ON public.user_book_library
    AS PERMISSIVE
    FOR DELETE
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can delete own book library" ON public.user_book_library;
CREATE POLICY "Users can delete own book library" ON public.user_book_library
    AS PERMISSIVE
    FOR DELETE
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can insert into their own book library" ON public.user_book_library;
CREATE POLICY "Users can insert into their own book library" ON public.user_book_library
    AS PERMISSIVE
    FOR INSERT
    TO public
    WITH CHECK ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can insert own book library" ON public.user_book_library;
CREATE POLICY "Users can insert own book library" ON public.user_book_library
    AS PERMISSIVE
    FOR INSERT
    TO public
    WITH CHECK ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can manage own book library" ON public.user_book_library;
CREATE POLICY "Users can manage own book library" ON public.user_book_library
    AS PERMISSIVE
    FOR ALL
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can update own book library" ON public.user_book_library;
CREATE POLICY "Users can update own book library" ON public.user_book_library
    AS PERMISSIVE
    FOR UPDATE
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can update their own book library" ON public.user_book_library;
CREATE POLICY "Users can update their own book library" ON public.user_book_library
    AS PERMISSIVE
    FOR UPDATE
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can view own book library" ON public.user_book_library;
CREATE POLICY "Users can view own book library" ON public.user_book_library
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can view their own book library" ON public.user_book_library;
CREATE POLICY "Users can view their own book library" ON public.user_book_library
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can delete from their own course library" ON public.user_course_library;
CREATE POLICY "Users can delete from their own course library" ON public.user_course_library
    AS PERMISSIVE
    FOR DELETE
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can delete own course library" ON public.user_course_library;
CREATE POLICY "Users can delete own course library" ON public.user_course_library
    AS PERMISSIVE
    FOR DELETE
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can insert into their own course library" ON public.user_course_library;
CREATE POLICY "Users can insert into their own course library" ON public.user_course_library
    AS PERMISSIVE
    FOR INSERT
    TO public
    WITH CHECK ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can insert own course library" ON public.user_course_library;
CREATE POLICY "Users can insert own course library" ON public.user_course_library
    AS PERMISSIVE
    FOR INSERT
    TO public
    WITH CHECK ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can manage own course library" ON public.user_course_library;
CREATE POLICY "Users can manage own course library" ON public.user_course_library
    AS PERMISSIVE
    FOR ALL
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can update own course library" ON public.user_course_library;
CREATE POLICY "Users can update own course library" ON public.user_course_library
    AS PERMISSIVE
    FOR UPDATE
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can update their own course library" ON public.user_course_library;
CREATE POLICY "Users can update their own course library" ON public.user_course_library
    AS PERMISSIVE
    FOR UPDATE
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can view own course library" ON public.user_course_library;
CREATE POLICY "Users can view own course library" ON public.user_course_library
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can view their own course library" ON public.user_course_library;
CREATE POLICY "Users can view their own course library" ON public.user_course_library
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users manage own flashcards" ON public.user_flashcards;
CREATE POLICY "Users manage own flashcards" ON public.user_flashcards
    AS PERMISSIVE
    FOR ALL
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Usuarios pueden borrar sus propias notas" ON public.user_notes;
CREATE POLICY "Usuarios pueden borrar sus propias notas" ON public.user_notes
    AS PERMISSIVE
    FOR DELETE
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Usuarios pueden crear sus propias notas" ON public.user_notes;
CREATE POLICY "Usuarios pueden crear sus propias notas" ON public.user_notes
    AS PERMISSIVE
    FOR INSERT
    TO public
    WITH CHECK ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Usuarios pueden editar sus propias notas" ON public.user_notes;
CREATE POLICY "Usuarios pueden editar sus propias notas" ON public.user_notes
    AS PERMISSIVE
    FOR UPDATE
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Usuarios pueden ver sus propias notas" ON public.user_notes;
CREATE POLICY "Usuarios pueden ver sus propias notas" ON public.user_notes
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can manage own question history" ON public.user_question_history;
CREATE POLICY "Users can manage own question history" ON public.user_question_history
    AS PERMISSIVE
    FOR ALL
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users insert own history" ON public.user_question_history;
CREATE POLICY "Users insert own history" ON public.user_question_history
    AS PERMISSIVE
    FOR INSERT
    TO public
    WITH CHECK ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users view own history" ON public.user_question_history;
CREATE POLICY "Users view own history" ON public.user_question_history
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_simulator_preferences;
CREATE POLICY "Users manage own preferences" ON public.user_simulator_preferences
    AS PERMISSIVE
    FOR ALL
    TO public
    USING ((auth.uid() = user_id))
;

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
    AS PERMISSIVE
    FOR UPDATE
    TO public
    USING ((auth.uid() = id))
;

DROP POLICY IF EXISTS "Users can update their own data." ON public.users;
CREATE POLICY "Users can update their own data." ON public.users
    AS PERMISSIVE
    FOR UPDATE
    TO public
    USING ((auth.uid() = id))
    WITH CHECK ((auth.uid() = id))
;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING ((auth.uid() = id))
;

DROP POLICY IF EXISTS "Users can view their own data." ON public.users;
CREATE POLICY "Users can view their own data." ON public.users
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING ((auth.uid() = id))
;

DROP POLICY IF EXISTS "Admins y Servidor ven tráfico" ON public.web_traffic;
CREATE POLICY "Admins y Servidor ven tráfico" ON public.web_traffic
    AS PERMISSIVE
    FOR SELECT
    TO public
    USING (true)
;

-- ------------------------------------------------------------------------------
-- 6. PERFORMANCE & UNIQUE INDEXES
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX careers_career_id_key ON public.careers USING btree (career_id);
CREATE INDEX idx_course_books_course ON public.course_books USING btree (course_id);
CREATE INDEX idx_course_books_resource ON public.course_books USING btree (resource_id);
CREATE UNIQUE INDEX courses_course_id_key ON public.courses USING btree (course_id);
CREATE INDEX idx_case_scenarios_domain_target_topic ON public.case_scenarios USING btree (domain, target, topic);
CREATE UNIQUE INDEX case_scenarios_code_key ON public.case_scenarios USING btree (code);
CREATE INDEX idx_courses_name_trgm ON public.courses USING gin (f_unaccent((name)::text) gin_trgm_ops);
CREATE INDEX idx_decks_public_category ON public.decks USING btree (is_public, category) WHERE (is_public = true);
CREATE INDEX idx_decks_user_parent ON public.decks USING btree (user_id, parent_id, type);
CREATE INDEX idx_page_views_entity ON public.page_views USING btree (entity_type, entity_id);
CREATE INDEX idx_payment_events_user_id ON public.payment_events USING btree (user_id, received_at DESC);
CREATE INDEX idx_qbank_domain ON public.question_bank USING btree (domain);
CREATE INDEX idx_qbank_topic ON public.question_bank USING btree (topic);
CREATE INDEX idx_question_bank_career ON public.question_bank USING btree (career);
CREATE INDEX idx_question_bank_case_id ON public.question_bank USING btree (case_id);
CREATE INDEX idx_question_bank_case_id_order ON public.question_bank USING btree (case_id, case_order ASC);
CREATE INDEX idx_question_bank_created_at ON public.question_bank USING btree (created_at DESC);
CREATE INDEX idx_question_bank_domain_topic_sub ON public.question_bank USING btree (domain, topic, subtopic);
CREATE UNIQUE INDEX question_bank_question_hash_key ON public.question_bank USING btree (question_hash);
CREATE INDEX idx_quiz_history_user_date ON public.quiz_history USING btree (user_id, created_at);
CREATE UNIQUE INDEX quiz_history_source_session_unique ON public.quiz_history USING btree (source_session_id) WHERE (source_session_id IS NOT NULL);
CREATE INDEX quiz_sessions_user_status_idx ON public.quiz_sessions USING btree (user_id, status, expires_at DESC);
CREATE INDEX quiz_session_questions_session_idx ON public.quiz_session_questions USING btree (session_id, position);
CREATE INDEX idx_resources_created_at ON public.resources USING btree (created_at DESC);
CREATE INDEX idx_resources_type_domain_vis_created ON public.resources USING btree (resource_type, domain, visible, created_at DESC);
CREATE UNIQUE INDEX resources_resource_id_key ON public.resources USING btree (resource_id);
CREATE UNIQUE INDEX resources_url_key ON public.resources USING btree (url);
CREATE INDEX idx_search_history_query ON public.search_history USING btree (query);
CREATE INDEX idx_topic_resources_resource ON public.topic_resources USING btree (resource_id);
CREATE INDEX idx_topic_resources_topic ON public.topic_resources USING btree (topic_id);
CREATE INDEX idx_topics_name_trgm ON public.topics USING gin (f_unaccent((name)::text) gin_trgm_ops);
CREATE UNIQUE INDEX topics_topic_id_key ON public.topics USING btree (topic_id);
CREATE INDEX idx_flashcards_user_review ON public.user_flashcards USING btree (user_id, next_review_at);
CREATE INDEX idx_user_flashcards_deck_sort ON public.user_flashcards USING btree (deck_id, sort_order, created_at);
CREATE INDEX idx_user_flashcards_user_deck_next ON public.user_flashcards USING btree (user_id, deck_id, next_review_at);
CREATE INDEX idx_uhist_user_q ON public.user_question_history USING btree (user_id, question_id);
CREATE UNIQUE INDEX unique_user_question ON public.user_question_history USING btree (user_id, question_id);
CREATE UNIQUE INDEX user_question_history_user_id_question_id_key ON public.user_question_history USING btree (user_id, question_id);
CREATE INDEX idx_users_name_trgm ON public.users USING gin (f_unaccent((name)::text) gin_trgm_ops);
CREATE INDEX idx_users_subscription_status ON public.users USING btree (subscription_status);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE INDEX idx_web_traffic_daily ON public.web_traffic USING btree (created_at);
CREATE INDEX idx_web_traffic_pulse ON public.web_traffic USING btree (last_ping);
