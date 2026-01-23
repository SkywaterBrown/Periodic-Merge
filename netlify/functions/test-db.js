const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    try {
        // Test the database connection
        const result = await sql`SELECT NOW() as current_time, VERSION() as postgres_version`;
        
        // Try to count leaderboard entries
        let leaderboardCount = 0;
        try {
            const countResult = await sql`SELECT COUNT(*) as count FROM leaderboards`;
            leaderboardCount = countResult[0]?.count || 0;
        } catch (e) {
            leaderboardCount = 'Table does not exist yet';
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                database: result[0],
                leaderboardCount,
                environment: {
                    hasDatabaseUrl: !!process.env.NETLIFY_DATABASE_URL,
                    nodeEnv: process.env.NODE_ENV
                }
            })
        };
        
    } catch (error) {
        console.error('Database test error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                envCheck: {
                    hasDatabaseUrl: !!process.env.NETLIFY_DATABASE_URL,
                    databaseUrlLength: process.env.NETLIFY_DATABASE_URL?.length || 0
                }
            })
        };
    }
};
