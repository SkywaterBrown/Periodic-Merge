const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS'
            }
        };
    }
    
    try {
        const category = event.queryStringParameters?.category || 'totalScore';
        const limit = parseInt(event.queryStringParameters?.limit) || 100;
        const playerName = event.queryStringParameters?.playerName;
        
        let results;
        
        if (playerName) {
            // Get leaderboard with player's rank
            results = await sql`
                WITH ranked AS (
                    SELECT 
                        player_name,
                        score,
                        country,
                        device_id,
                        submitted_at,
                        RANK() OVER (ORDER BY score DESC) as rank
                    FROM leaderboards
                    WHERE category = ${category}
                    ORDER BY score DESC
                    LIMIT ${limit}
                )
                SELECT * FROM ranked
                UNION ALL
                SELECT 
                    player_name,
                    score,
                    country,
                    device_id,
                    submitted_at,
                    RANK() OVER (ORDER BY score DESC) as rank
                FROM leaderboards
                WHERE category = ${category} 
                AND player_name = ${playerName}
                AND player_name NOT IN (SELECT player_name FROM ranked)
                LIMIT 1
            `;
        } else {
            // Get top scores only
            results = await sql`
                SELECT 
                    player_name,
                    score,
                    country,
                    device_id,
                    submitted_at,
                    RANK() OVER (ORDER BY score DESC) as rank
                FROM leaderboards
                WHERE category = ${category}
                ORDER BY score DESC
                LIMIT ${limit}
            `;
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                category,
                leaderboard: results
            })
        };
        
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to fetch leaderboard',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    }
};