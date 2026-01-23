-- Create leaderboards table
CREATE TABLE IF NOT EXISTS leaderboards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_name VARCHAR(255) NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0),
    category VARCHAR(50) NOT NULL,
    device_id VARCHAR(255),
    country VARCHAR(2) DEFAULT '??',
    submitted_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS cloud_saves (
    device_id VARCHAR(255) PRIMARY KEY,
    save_data JSONB NOT NULL,
    saved_at TIMESTAMP DEFAULT NOW(),
    last_accessed TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_leaderboards_category_score ON leaderboards(category, score DESC);
CREATE INDEX idx_leaderboards_player_category ON leaderboards(player_name, category);
CREATE INDEX idx_leaderboards_submitted_at ON leaderboards(submitted_at DESC);
CREATE INDEX idx_cloud_saves_device_id ON cloud_saves(device_id);

-- Create view for global rankings
CREATE OR REPLACE VIEW global_leaderboard AS
SELECT 
    player_name,
    SUM(CASE WHEN category = 'totalScore' THEN score ELSE 0 END) as total_score,
    SUM(CASE WHEN category = 'elementsFound' THEN score ELSE 0 END) as elements_score,
    SUM(CASE WHEN category = 'topFusions' THEN score ELSE 0 END) as fusions_score,
    MAX(submitted_at) as last_active,
    COUNT(*) as games_played,
    MAX(country) as country
FROM leaderboards
GROUP BY player_name;

-- Function to get player's rank in a category
CREATE OR REPLACE FUNCTION get_player_rank(
    p_player_name VARCHAR,
    p_category VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    player_rank INTEGER;
BEGIN
    SELECT rank INTO player_rank
    FROM (
        SELECT 
            player_name,
            RANK() OVER (ORDER BY score DESC) as rank
        FROM leaderboards
        WHERE category = p_category
    ) ranked
    WHERE player_name = p_player_name
    LIMIT 1;
    
    RETURN COALESCE(player_rank, 0);
END;
$$ LANGUAGE plpgsql;

-- Create daily leaderboard (automatically cleaned)
CREATE OR REPLACE VIEW daily_leaderboard AS
SELECT 
    player_name,
    category,
    score,
    country,
    RANK() OVER (PARTITION BY category ORDER BY score DESC) as rank
FROM leaderboards
WHERE submitted_at >= NOW() - INTERVAL '24 hours'
ORDER BY category, score DESC;
