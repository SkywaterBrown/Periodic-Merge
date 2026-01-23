const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NETLIFY_DATABASE_URL);

// Simple API key validation - you can make this more sophisticated
const isValidApiKey = (apiKey) => {
    // For now, accept any non-empty API key
    // You could implement:
    // - JWT validation
    // - API key database lookup
    // - Environment variable check
    return apiKey && apiKey.trim().length > 0;
};

exports.handler = async (event, context) => {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Max-Age': '86400'
            }
        };
    }
    
    // For GET requests (loading saves)
    if (event.httpMethod === 'GET') {
        try {
            const { deviceId } = event.queryStringParameters;
            
            if (!deviceId) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ 
                        success: false, 
                        error: 'Device ID is required' 
                    })
                };
            }
            
            // Optional: Check API key for GET requests
            // const apiKey = event.headers['x-api-key'] || event.headers.authorization?.replace('Bearer ', '');
            // if (!isValidApiKey(apiKey)) {
            //     return {
            //         statusCode: 401,
            //         headers: {
            //             'Content-Type': 'application/json',
            //             'Access-Control-Allow-Origin': '*'
            //         },
            //         body: JSON.stringify({ 
            //             success: false, 
            //             error: 'Unauthorized' 
            //         })
            //     };
            // }
            
            // Get the latest save for this device
            const result = await sql`
                SELECT 
                    save_data,
                    saved_at,
                    last_accessed
                FROM cloud_saves 
                WHERE device_id = ${deviceId}
                ORDER BY saved_at DESC 
                LIMIT 1
            `;
            
            // Update last accessed time
            if (result.length > 0) {
                await sql`
                    UPDATE cloud_saves 
                    SET last_accessed = NOW()
                    WHERE device_id = ${deviceId}
                    AND saved_at = ${result[0].saved_at}
                `;
            }
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-store, max-age=0'
                },
                body: JSON.stringify({ 
                    success: true, 
                    saveData: result[0]?.save_data || null,
                    lastSaved: result[0]?.saved_at || null
                })
            };
            
        } catch (error) {
            console.error('Cloud load error:', error);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Failed to load save data',
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
                })
            };
        }
    }
    
    // For POST requests (saving)
    if (event.httpMethod === 'POST') {
        try {
            // Check content type
            if (!event.headers['content-type']?.includes('application/json')) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ 
                        success: false, 
                        error: 'Content-Type must be application/json' 
                    })
                };
            }
            
            const data = JSON.parse(event.body);
            const { deviceId, saveData, playerName, version = '1.0' } = data;
            
            // Validate required fields
            if (!deviceId || !saveData) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ 
                        success: false, 
                        error: 'Device ID and save data are required' 
                    })
                };
            }
            
            // Validate save data structure
            if (typeof saveData !== 'object' || saveData === null) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ 
                        success: false, 
                        error: 'Save data must be a valid JSON object' 
                    })
                };
            }
            
            // Optional: Check API key for POST requests
            // const apiKey = event.headers['x-api-key'] || event.headers.authorization?.replace('Bearer ', '');
            // if (!isValidApiKey(apiKey)) {
            //     return {
            //         statusCode: 401,
            //         headers: {
            //             'Content-Type': 'application/json',
            //             'Access-Control-Allow-Origin': '*'
            //         },
            //         body: JSON.stringify({ 
            //             success: false, 
            //             error: 'Unauthorized - Invalid API key' 
            //         })
            //     };
            // }
            
            // Enhanced save data with metadata
            const enhancedSaveData = {
                ...saveData,
                _metadata: {
                    version,
                    playerName: playerName || 'Anonymous',
                    deviceId,
                    savedAt: new Date().toISOString(),
                    size: JSON.stringify(saveData).length
                }
            };
            
            // Save to database with upsert (insert or update)
            const result = await sql`
                INSERT INTO cloud_saves (device_id, save_data, saved_at)
                VALUES (${deviceId}, ${JSON.stringify(enhancedSaveData)}, NOW())
                ON CONFLICT (device_id) 
                DO UPDATE SET 
                    save_data = ${JSON.stringify(enhancedSaveData)},
                    saved_at = NOW(),
                    last_accessed = NOW()
                RETURNING saved_at
            `;
            
            // Log successful save (optional)
            console.log(`Cloud save successful for device: ${deviceId}, player: ${playerName || 'Anonymous'}`);
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    success: true,
                    message: 'Save successful',
                    savedAt: result[0]?.saved_at,
                    deviceId
                })
            };
            
        } catch (error) {
            console.error('Cloud save error:', error);
            
            // Handle specific database errors
            let errorMessage = 'Failed to save data';
            let statusCode = 500;
            
            if (error.message.includes('invalid input syntax for type json')) {
                errorMessage = 'Invalid save data format';
                statusCode = 400;
            } else if (error.message.includes('value too long')) {
                errorMessage = 'Save data too large (max 1MB)';
                statusCode = 413;
            } else if (error.message.includes('connection') || error.message.includes('timeout')) {
                errorMessage = 'Database connection error';
                statusCode = 503;
            }
            
            return {
                statusCode,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    success: false, 
                    error: errorMessage,
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
                })
            };
        }
    }
    
    // For DELETE requests (optional cleanup)
    if (event.httpMethod === 'DELETE') {
        try {
            const { deviceId } = event.queryStringParameters;
            
            if (!deviceId) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ 
                        success: false, 
                        error: 'Device ID is required' 
                    })
                };
            }
            
            await sql`
                DELETE FROM cloud_saves 
                WHERE device_id = ${deviceId}
            `;
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    success: true,
                    message: 'Save data deleted'
                })
            };
            
        } catch (error) {
            console.error('Cloud delete error:', error);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Failed to delete save data' 
                })
            };
        }
    }
    
    // Method not allowed
    return {
        statusCode: 405,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Allow': 'GET, POST, DELETE, OPTIONS'
        },
        body: JSON.stringify({ 
            success: false, 
            error: 'Method not allowed' 
        })
    };
};
