const { neon } = require('@netlify/neon');

const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        };
    }
    
    try {
        const body = JSON.parse(event.body);
        const { playerName, score, category, deviceId, country } = body;
        
        // Validate required fields
        if (!playerName || score === undefined || !category) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Missing required fields'
                })
            };
        }
        
        // Get user's IP for country detection (fallback)
        const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'];
        
        // Submit score - allow multiple entries per player per category
        const result = await sql`
            INSERT INTO leaderboards (player_name, score, category, device_id, country, submitted_at)
            VALUES (${playerName}, ${score}, ${category}, ${deviceId || 'unknown'}, ${country || 'Unknown'}, NOW())
            RETURNING *
        `;
        
        // Get player's new rank
        const [rankResult] = await sql`
            SELECT rank FROM (
                SELECT 
                    player_name,
                    score,
                    RANK() OVER (ORDER BY score DESC) as rank
                FROM leaderboards
                WHERE category = ${category}
            ) ranked
            WHERE player_name = ${playerName} 
            ORDER BY score DESC
            LIMIT 1
        `;
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                rank: rankResult?.rank || 0,
                score: result[0].score
            })
        };
        
    } catch (error) {
        console.error('Error submitting score:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to submit score'
            })
        };
    }
};
