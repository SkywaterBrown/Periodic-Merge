const { neon } = require('@netlify/neon');

const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    try {
        const category = event.queryStringParameters?.category || 'totalScore';
        const limit = event.queryStringParameters?.limit || 100;
        const playerName = event.queryStringParameters?.playerName;
        
        let query;
        let params = [category];
        
        if (playerName) {
            // Get leaderboard with player's rank
            query = `
                WITH ranked AS (
                    SELECT 
                        player_name,
                        score,
                        country,
                        device_id,
                        submitted_at,
                        RANK() OVER (ORDER BY score DESC) as rank
                    FROM leaderboards
                    WHERE category = $1
                    ORDER BY score DESC
                    LIMIT $2
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
                WHERE category = $1 
                AND player_name = $3
                AND player_name NOT IN (SELECT player_name FROM ranked)
                LIMIT 1
            `;
            params = [category, limit, playerName];
        } else {
            // Get top scores only
            query = `
                SELECT 
                    player_name,
                    score,
                    country,
                    device_id,
                    submitted_at,
                    RANK() OVER (ORDER BY score DESC) as rank
                FROM leaderboards
                WHERE category = $1
                ORDER BY score DESC
                LIMIT $2
            `;
            params = [category, limit];
        }
        
        const results = await sql(query, params);
        
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
                error: 'Failed to fetch leaderboard'
            })
        };
    }
};
