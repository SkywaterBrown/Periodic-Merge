const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    try {
        // Try to create tables (will fail gracefully if they exist)
        const results = [];
        
        // Create leaderboards table
        try {
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
                )
            `;
            results.push('leaderboards table: OK');
        } catch (e) {
            results.push(`leaderboards table: ${e.message}`);
        }
        
        // Create cloud_saves table
        try {
            await sql`
                CREATE TABLE IF NOT EXISTS cloud_saves (
                    device_id VARCHAR(255) PRIMARY KEY,
                    save_data JSONB NOT NULL,
                    saved_at TIMESTAMP DEFAULT NOW(),
                    last_accessed TIMESTAMP DEFAULT NOW()
                )
            `;
            results.push('cloud_saves table: OK');
        } catch (e) {
            results.push(`cloud_saves table: ${e.message}`);
        }
        
        // Create indexes
        try {
            await sql`
                CREATE INDEX IF NOT EXISTS idx_leaderboards_category_score 
                ON leaderboards(category, score DESC)
            `;
            results.push('index idx_leaderboards_category_score: OK');
        } catch (e) {
            results.push(`index creation: ${e.message}`);
        }
        
        // Test connection with a simple query
        const testQuery = await sql`SELECT NOW() as time, VERSION() as version`;
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                success: true, 
                message: 'Database check completed',
                results,
                database: testQuery[0]
            })
        };
        
    } catch (error) {
        console.error('Database setup error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                success: false, 
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};
