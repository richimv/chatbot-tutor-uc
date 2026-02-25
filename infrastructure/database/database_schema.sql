-- Database Schema Dump
-- Generated at: 2026-01-16T18:38:34.237Z

-- Table: careers
CREATE TABLE IF NOT EXISTS public.careers (
    id INTEGER DEFAULT nextval('careers_id_seq'::regclass) NOT NULL,
    career_id CHARACTER VARYING(50) NOT NULL,
    name CHARACTER VARYING(255) NOT NULL,
    area USER-DEFINED NOT NULL,
    image_url TEXT,
    CONSTRAINT careers_pkey PRIMARY KEY (id)
);

-- Table: chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT chat_messages_pkey PRIMARY KEY (id)
);

-- Table: conversations
CREATE TABLE IF NOT EXISTS public.conversations (
    id BIGINT NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    user_id UUID,
    CONSTRAINT conversations_pkey PRIMARY KEY (id)
);

-- Table: course_books
CREATE TABLE IF NOT EXISTS public.course_books (
    course_id INTEGER NOT NULL,
    resource_id INTEGER NOT NULL,
    CONSTRAINT course_books_pkey PRIMARY KEY (course_id, resource_id)
);

-- Table: course_careers
CREATE TABLE IF NOT EXISTS public.course_careers (
    course_id INTEGER NOT NULL,
    career_id INTEGER NOT NULL,
    CONSTRAINT course_careers_pkey PRIMARY KEY (course_id, career_id)
);

-- Table: course_topics
CREATE TABLE IF NOT EXISTS public.course_topics (
    course_id INTEGER NOT NULL,
    topic_id INTEGER NOT NULL,
    unit_name CHARACTER VARYING(255) DEFAULT 'General'::character varying,
    CONSTRAINT course_topics_pkey PRIMARY KEY (course_id, topic_id)
);

-- Table: courses
CREATE TABLE IF NOT EXISTS public.courses (
    id INTEGER DEFAULT nextval('courses_id_seq'::regclass) NOT NULL,
    course_id CHARACTER VARYING(50) NOT NULL,
    name CHARACTER VARYING(255) NOT NULL,
    image_url TEXT,
    CONSTRAINT courses_pkey PRIMARY KEY (id)
);

-- Table: feedback
CREATE TABLE IF NOT EXISTS public.feedback (
    id INTEGER DEFAULT nextval('feedback_id_seq'::regclass) NOT NULL,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    message_id BIGINT,
    CONSTRAINT feedback_pkey PRIMARY KEY (id)
);

-- Table: page_views
CREATE TABLE IF NOT EXISTS public.page_views (
    id BIGINT DEFAULT nextval('page_views_id_seq'::regclass) NOT NULL,
    entity_type CHARACTER VARYING(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT page_views_pkey PRIMARY KEY (id)
);

-- Table: resources
CREATE TABLE IF NOT EXISTS public.resources (
    id INTEGER DEFAULT nextval('resources_id_seq'::regclass) NOT NULL,
    resource_id CHARACTER VARYING(50) NOT NULL,
    title CHARACTER VARYING(255) NOT NULL,
    author CHARACTER VARYING(255),
    url CHARACTER VARYING(255),
    size CHARACTER VARYING(50),
    image_url CHARACTER VARYING(500),
    publication_year INTEGER,
    publisher CHARACTER VARYING(255),
    edition CHARACTER VARYING(100),
    city CHARACTER VARYING(100),
    isbn CHARACTER VARYING(50),
    resource_type CHARACTER VARYING(50) DEFAULT 'book'::character varying,
    CONSTRAINT resources_pkey PRIMARY KEY (id)
);

-- Table: search_history
CREATE TABLE IF NOT EXISTS public.search_history (
    id INTEGER DEFAULT nextval('search_history_id_seq'::regclass) NOT NULL,
    query TEXT NOT NULL,
    results_count INTEGER NOT NULL,
    is_educational_query BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source CHARACTER VARYING(50) DEFAULT 'search_bar'::character varying,
    user_id UUID,
    CONSTRAINT search_history_pkey PRIMARY KEY (id)
);

-- Table: topic_resources
CREATE TABLE IF NOT EXISTS public.topic_resources (
    topic_id INTEGER NOT NULL,
    resource_id INTEGER NOT NULL,
    CONSTRAINT topic_resources_pkey PRIMARY KEY (topic_id, resource_id)
);

-- Table: topics
CREATE TABLE IF NOT EXISTS public.topics (
    id INTEGER DEFAULT nextval('topics_id_seq'::regclass) NOT NULL,
    topic_id CHARACTER VARYING(50) NOT NULL,
    name CHARACTER VARYING(255) NOT NULL,
    CONSTRAINT topics_pkey PRIMARY KEY (id)
);

-- Table: user_book_library
CREATE TABLE IF NOT EXISTS public.user_book_library (
    user_id UUID NOT NULL,
    book_id INTEGER NOT NULL,
    is_saved BOOLEAN DEFAULT false,
    is_favorite BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_book_library_pkey PRIMARY KEY (user_id, book_id)
);

-- Table: user_course_library
CREATE TABLE IF NOT EXISTS public.user_course_library (
    user_id UUID NOT NULL,
    course_id INTEGER NOT NULL,
    is_saved BOOLEAN DEFAULT false,
    is_favorite BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_course_library_pkey PRIMARY KEY (user_id, course_id)
);

-- Table: users
CREATE TABLE IF NOT EXISTS public.users (
    name CHARACTER VARYING(255) NOT NULL,
    email CHARACTER VARYING(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role CHARACTER VARYING(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    id UUID NOT NULL,
    subscription_status CHARACTER VARYING(50) DEFAULT 'pending'::character varying,
    payment_id CHARACTER VARYING(255) DEFAULT NULL::character varying,
    usage_count INTEGER DEFAULT 0,
    max_free_limit INTEGER DEFAULT 3,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

ALTER TABLE ONLY public.course_topics
    ADD CONSTRAINT course_topics_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);

ALTER TABLE ONLY public.course_topics
    ADD CONSTRAINT course_topics_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id);

ALTER TABLE ONLY public.course_books
    ADD CONSTRAINT course_books_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);

ALTER TABLE ONLY public.course_books
    ADD CONSTRAINT course_books_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id);

-- ✅ MODIFIED: ON DELETE CASCADE
ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

-- ✅ MODIFIED: ON DELETE CASCADE
ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ✅ MODIFIED: ON DELETE CASCADE
ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ✅ MODIFIED: ON DELETE CASCADE
ALTER TABLE ONLY public.search_history
    ADD CONSTRAINT search_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ✅ MODIFIED: ON DELETE CASCADE
ALTER TABLE ONLY public.page_views
    ADD CONSTRAINT page_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ✅ MODIFIED: ON DELETE CASCADE
ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT fk_feedback_message FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.course_careers
    ADD CONSTRAINT course_careers_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);

ALTER TABLE ONLY public.course_careers
    ADD CONSTRAINT course_careers_career_id_fkey FOREIGN KEY (career_id) REFERENCES public.careers(id);

ALTER TABLE ONLY public.topic_resources
    ADD CONSTRAINT topic_resources_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id);

ALTER TABLE ONLY public.topic_resources
    ADD CONSTRAINT topic_resources_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id);

-- ✅ MODIFIED: ON DELETE CASCADE
ALTER TABLE ONLY public.user_course_library
    ADD CONSTRAINT user_course_library_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_course_library
    ADD CONSTRAINT user_course_library_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);

-- ✅ MODIFIED: ON DELETE CASCADE
ALTER TABLE ONLY public.user_book_library
    ADD CONSTRAINT user_book_library_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_book_library
    ADD CONSTRAINT user_book_library_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.resources(id);

-- Table: quiz_scores (Added manually as it was missing from original dump)
CREATE TABLE IF NOT EXISTS public.quiz_scores (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    topic TEXT NOT NULL,
    difficulty CHARACTER VARYING(50) NOT NULL,
    score INTEGER NOT NULL,
    correct_answers_count INTEGER DEFAULT 0,
    total_questions_played INTEGER DEFAULT 10,
    rounds_completed INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT quiz_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Habilitar RLS en quiz_scores existente
ALTER TABLE public.quiz_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read for Leaderboard" ON public.quiz_scores
FOR SELECT USING (true);

CREATE POLICY "Authenticated Insert" ON public.quiz_scores
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 🛡️ SECURITY & NEW MODULES (Consolidated)
-- ==========================================

-- 1. DOCUMENTS (RAG System)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.documents (
    id BIGSERIAL PRIMARY KEY,
    content TEXT,
    metadata JSONB,
    embedding VECTOR(768)
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Allow public read access (Shared Knowledge Base)
CREATE POLICY "Public Read Documents" ON public.documents
FOR SELECT USING (true);

-- 2. DECKS & FLASHCARDS (Training Module)
CREATE TABLE IF NOT EXISTS public.decks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'USER', -- 'SYSTEM' or 'USER'
    source_module VARCHAR(50) DEFAULT 'MANUAL', -- 'MEDICINA', 'IDIOMAS', etc.
    icon VARCHAR(10) DEFAULT '📚',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own decks" ON public.decks
FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_flashcards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    deck_id UUID REFERENCES public.decks(id) ON DELETE CASCADE, -- ✅ Added deck_id
    front_content TEXT NOT NULL,
    back_content TEXT NOT NULL,
    topic VARCHAR(100),
    source_quiz_id UUID,
    repetition_number INTEGER DEFAULT 0,
    easiness_factor REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 0,
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    next_review_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own flashcards" ON public.user_flashcards
FOR ALL USING (auth.uid() = user_id);

-- 3. QUIZ HISTORY (Analytics)
CREATE TABLE IF NOT EXISTS public.quiz_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    topic VARCHAR(100) NOT NULL,
    difficulty VARCHAR(20) DEFAULT 'ENAM',
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    weak_points TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.quiz_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history" ON public.quiz_history
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON public.quiz_history
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. ARENA SCORES (Arcade Mode)
CREATE TABLE IF NOT EXISTS public.arena_scores (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    max_combo INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.arena_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Leaderboard Arena" ON public.arena_scores
FOR SELECT USING (true);

CREATE POLICY "Users insert own arena score" ON public.arena_scores
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flashcards_user_review ON public.user_flashcards(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_quiz_history_user_date ON public.quiz_history(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_arena_scores_score ON public.arena_scores (score DESC);

-- 5. MULTI-SIMULATOR PREFERENCES
CREATE TABLE IF NOT EXISTS public.user_simulator_preferences (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    domain VARCHAR(50) NOT NULL,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, domain)
);

ALTER TABLE public.user_simulator_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences" ON public.user_simulator_preferences
    FOR ALL USING (auth.uid() = user_id);


