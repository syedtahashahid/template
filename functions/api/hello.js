/**
 * Default API Handler Template
 * GET /api/hello
 */
export async function onRequestGet(context) {
    const { env } = context;

    return new Response(JSON.stringify({
        success: true,
        message: 'Hello from the Worker Template!',
        timestamp: new Date().toISOString(),
        databaseConfigured: !!env.DB
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}
