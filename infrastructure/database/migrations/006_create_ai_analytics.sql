-- Migration: Create ai_analytics table
CREATE TABLE IF NOT EXISTS public.ai_analytics (
    id SERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    intent_type VARCHAR(50) NOT NULL, -- 'educational_card', 'related_resources'
    event_type VARCHAR(50) NOT NULL, -- 'impression', 'click'
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster querying by time and event type
CREATE INDEX IF NOT EXISTS idx_ai_analytics_created_at ON public.ai_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_analytics_event_type ON public.ai_analytics(event_type);
