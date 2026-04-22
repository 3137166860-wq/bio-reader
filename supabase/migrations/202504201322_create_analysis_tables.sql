-- Create a table for storing PDF analysis history
CREATE TABLE IF NOT EXISTS analysis_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    pdf_name TEXT NOT NULL,
    extracted_text TEXT, -- store truncated text if needed
    extracted_json JSONB NOT NULL,
    category TEXT, -- paper category from Stage 1 classifier
    client_timestamp BIGINT, -- client-generated timestamp for LWW conflict resolution
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for faster user-based queries
CREATE INDEX IF NOT EXISTS analysis_history_user_id_idx ON analysis_history(user_id);
CREATE INDEX IF NOT EXISTS analysis_history_client_ts_idx ON analysis_history(client_timestamp);

-- Enable Row Level Security
ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;

-- Create policy: users can only see their own records
CREATE POLICY "Users can view own analysis history"
    ON analysis_history
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy: users can insert their own records
CREATE POLICY "Users can insert own analysis history"
    ON analysis_history
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policy: users can update their own records (optional)
CREATE POLICY "Users can update own analysis history"
    ON analysis_history
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Create policy: users can delete their own records (optional)
CREATE POLICY "Users can delete own analysis history"
    ON analysis_history
    FOR DELETE
    USING (auth.uid() = user_id);

-- ── Atomic update function with LWW conflict resolution ──
-- Called by the Edge API route via supabase.rpc()
-- Only updates if the incoming client_timestamp >= existing one (or existing is NULL)
CREATE OR REPLACE FUNCTION update_analysis_atomic(
    p_id UUID,
    p_extracted_json JSONB,
    p_client_timestamp BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE analysis_history
    SET
        extracted_json = p_extracted_json,
        client_timestamp = p_client_timestamp,
        updated_at = NOW()
    WHERE id = p_id
      AND (
          client_timestamp IS NULL
          OR client_timestamp <= p_client_timestamp
      );

    RETURN FOUND;
END;
$$;
