-- Database Schema Extraction --

-- Table: careers
CREATE TABLE IF NOT EXISTS public.careers (
    id INTEGER NOT NULL DEFAULT nextval('careers_id_seq'::regclass),
    career_id CHARACTER VARYING(50) NOT NULL,
    name CHARACTER VARYING(255) NOT NULL,
    area ACADEMIC_AREA NOT NULL,
    image_url TEXT
);

-- Table: chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: conversations
CREATE TABLE IF NOT EXISTS public.conversations (
    id BIGINT NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    user_id UUID
);

-- Table: course_books
CREATE TABLE IF NOT EXISTS public.course_books (
    course_id INTEGER NOT NULL,
    resource_id INTEGER NOT NULL
);

-- Table: course_careers
CREATE TABLE IF NOT EXISTS public.course_careers (
    course_id INTEGER NOT NULL,
    career_id INTEGER NOT NULL
);

-- Table: course_topics
CREATE TABLE IF NOT EXISTS public.course_topics (
    course_id INTEGER NOT NULL,
    topic_id INTEGER NOT NULL,
    unit_name CHARACTER VARYING(255) DEFAULT 'General'::character varying
);

-- Table: courses
CREATE TABLE IF NOT EXISTS public.courses (
    id INTEGER NOT NULL DEFAULT nextval('courses_id_seq'::regclass),
    course_id CHARACTER VARYING(50) NOT NULL,
    name CHARACTER VARYING(255) NOT NULL,
    image_url TEXT
);

-- Table: decks
CREATE TABLE IF NOT EXISTS public.decks (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name CHARACTER VARYING(100) NOT NULL,
    type CHARACTER VARYING(20) DEFAULT 'USER'::character varying,
    source_module CHARACTER VARYING(50) DEFAULT 'MANUAL'::character varying,
    icon CHARACTER VARYING(50) DEFAULT '📚'::character varying,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    parent_id UUID
);

-- Table: documents
CREATE TABLE IF NOT EXISTS public.documents (
    id BIGINT NOT NULL DEFAULT nextval('documents_id_seq'::regclass),
    content TEXT,
    metadata JSONB,
    fts TSVECTOR
);

-- Table: feedback
CREATE TABLE IF NOT EXISTS public.feedback (
    id INTEGER NOT NULL DEFAULT nextval('feedback_id_seq'::regclass),
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    message_id BIGINT
);

-- Table: page_views
CREATE TABLE IF NOT EXISTS public.page_views (
    id BIGINT NOT NULL DEFAULT nextval('page_views_id_seq'::regclass),
    entity_type CHARACTER VARYING(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table: question_bank
CREATE TABLE IF NOT EXISTS public.question_bank (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    domain CHARACTER VARYING(255) DEFAULT 'GENERAL'::character varying,
    topic CHARACTER VARYING(100) NOT NULL,
    difficulty CHARACTER VARYING(50) DEFAULT 'Intermedio'::character varying,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_option_index INTEGER NOT NULL,
    explanation TEXT,
    times_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    question_hash TEXT,
    image_url TEXT,
    target CHARACTER VARYING(255),
    career CHARACTER VARYING(100),
    subtopic CHARACTER VARYING(255)
);

-- Table: quiz_history
CREATE TABLE IF NOT EXISTS public.quiz_history (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    topic CHARACTER VARYING(100) NOT NULL,
    difficulty CHARACTER VARYING(20) DEFAULT 'ENAM'::character varying,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    weak_points ARRAY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    area_stats JSONB DEFAULT '{}'::jsonb,
    target CHARACTER VARYING(50),
    career CHARACTER VARYING(100)
);

-- Table: quiz_scores
CREATE TABLE IF NOT EXISTS public.quiz_scores (
    id BIGINT NOT NULL,
    user_id UUID NOT NULL,
    topic CHARACTER VARYING(255) NOT NULL,
    difficulty CHARACTER VARYING(50),
    score INTEGER NOT NULL DEFAULT 0,
    rounds_completed INTEGER DEFAULT 1,
    correct_answers_count INTEGER DEFAULT 0,
    total_questions_played INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Table: resources
CREATE TABLE IF NOT EXISTS public.resources (
    id INTEGER NOT NULL DEFAULT nextval('resources_id_seq'::regclass),
    resource_id CHARACTER VARYING(50) NOT NULL,
    title CHARACTER VARYING(255) NOT NULL,
    author CHARACTER VARYING(255),
    url CHARACTER VARYING(255),
    image_url CHARACTER VARYING(500),
    resource_type CHARACTER VARYING(50) DEFAULT 'book'::character varying,
    is_premium BOOLEAN DEFAULT false
);

-- Table: search_history
CREATE TABLE IF NOT EXISTS public.search_history (
    id INTEGER NOT NULL DEFAULT nextval('search_history_id_seq'::regclass),
    query TEXT NOT NULL,
    results_count INTEGER NOT NULL,
    is_educational_query BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source CHARACTER VARYING(50) DEFAULT 'search_bar'::character varying,
    user_id UUID
);

-- Table: topic_resources
CREATE TABLE IF NOT EXISTS public.topic_resources (
    topic_id INTEGER NOT NULL,
    resource_id INTEGER NOT NULL
);

-- Table: topics
CREATE TABLE IF NOT EXISTS public.topics (
    id INTEGER NOT NULL DEFAULT nextval('topics_id_seq'::regclass),
    topic_id CHARACTER VARYING(50) NOT NULL,
    name CHARACTER VARYING(255) NOT NULL
);

-- Table: user_book_library
CREATE TABLE IF NOT EXISTS public.user_book_library (
    user_id UUID NOT NULL,
    book_id INTEGER NOT NULL,
    is_saved BOOLEAN DEFAULT false,
    is_favorite BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: user_course_library
CREATE TABLE IF NOT EXISTS public.user_course_library (
    user_id UUID NOT NULL,
    course_id INTEGER NOT NULL,
    is_saved BOOLEAN DEFAULT false,
    is_favorite BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: user_flashcards
CREATE TABLE IF NOT EXISTS public.user_flashcards (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    front_content TEXT NOT NULL,
    back_content TEXT NOT NULL,
    topic CHARACTER VARYING(100),
    source_quiz_id UUID,
    repetition_number INTEGER DEFAULT 0,
    easiness_factor REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 0,
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    next_review_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    deck_id UUID,
    sort_order INTEGER DEFAULT 0,
    last_quality INTEGER DEFAULT 0
);

-- Table: user_question_history
CREATE TABLE IF NOT EXISTS public.user_question_history (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID,
    question_id UUID,
    seen_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    times_seen INTEGER DEFAULT 1
);

-- Table: user_simulator_preferences
CREATE TABLE IF NOT EXISTS public.user_simulator_preferences (
    user_id UUID NOT NULL,
    domain CHARACTER VARYING(50) NOT NULL,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: users
CREATE TABLE IF NOT EXISTS public.users (
    name CHARACTER VARYING(255) NOT NULL,
    email CHARACTER VARYING(255) NOT NULL,
    password_hash TEXT,
    role CHARACTER VARYING(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    id UUID NOT NULL,
    subscription_status CHARACTER VARYING(50) DEFAULT 'pending'::character varying,
    payment_id CHARACTER VARYING(255) DEFAULT NULL::character varying,
    usage_count INTEGER DEFAULT 0,
    max_free_limit INTEGER DEFAULT 50,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    monthly_flashcards_usage INTEGER DEFAULT 0,
    subscription_tier CHARACTER VARYING(50) DEFAULT 'free'::character varying,
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    daily_ai_usage INTEGER DEFAULT 0,
    daily_arena_usage INTEGER DEFAULT 0,
    last_usage_reset DATE
);

-- Table: web_traffic
CREATE TABLE IF NOT EXISTS public.web_traffic (
    session_id UUID NOT NULL,
    user_id UUID,
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_mobile BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
