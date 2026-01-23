const { neon } = require('@netlify/neon');

const sql = neon(process.env.NETLIFY_DATABASE_URL);

exports.handler = async (event, context) => {
    try {
        const playerName = event.queryStringParameters?.playerName;
        
        if (!playerName) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Missing playerName parameter'
                })
            };
        }
        
        // Get player's best scores and ranks across all categories
        const stats = await sql`
            WITH player_scores AS (
                SELECT 
                    category,
                    MAX(score) as best_score,
                    COUNT(*) as submissions,
                    MAX(submitted_at) as last_submission
                FROM leaderboards
                WHERE player_name = ${playerName}
                GROUP BY category
            ),
            player_ranks AS (
                SELECT 
                    l.category,
                    l.player_name,
                    l.score,
                    RANK() OVER (PARTITION BY l.category ORDER BY l.score DESC) as rank
                FROM leaderboards l
                WHERE l.player_name = ${playerName}
            )
            SELECT 
                ps.category,
                ps.best_score,
                ps.submissions,
                ps.last_submission,
                pr.rank
            FROM player_scores ps
            LEFT JOIN player_ranks pr ON ps.category = pr.category
            ORDER BY ps.category
        `;
        
        // Get overall statistics
        const [overall] = await sql`
            SELECT 
                COUNT(DISTINCT player_name) as total_players,
                COUNT(*) as total_submissions,
                MAX(submitted_at) as last_global_submission
            FROM leaderboards
        `;
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                stats,
                overall
            })
        };
        
    } catch (error) {
        console.error('Error fetching player stats:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to fetch player stats'
            })
        };
    }
};
