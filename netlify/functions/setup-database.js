const { neon } = require('@netlify/neon');

const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    try {
        // Create leaderboards table
        await sql`
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
        `;
        
        // Create cloud_saves table
        await sql`
            CREATE TABLE IF NOT EXISTS cloud_saves (
                device_id VARCHAR(255) PRIMARY KEY,
                save_data JSONB NOT NULL,
                saved_at TIMESTAMP DEFAULT NOW(),
                last_accessed TIMESTAMP DEFAULT NOW()
            );
        `;
        
        // Create indexes
        await sql`
            CREATE INDEX IF NOT EXISTS idx_leaderboards_category_score 
            ON leaderboards(category, score DESC);
        `;
        
        await sql`
            CREATE INDEX IF NOT EXISTS idx_leaderboards_player_category 
            ON leaderboards(player_name, category);
        `;
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                message: 'Database tables created successfully' 
            })
        };
        
    } catch (error) {
        console.error('Database setup error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};
