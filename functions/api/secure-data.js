/**
 * Secure API Handler Template
 * POST /api/secure-data
 * Requires HMAC Signature (handled by middleware)
 */
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const data = await request.json();

        return new Response(JSON.stringify({
            success: true,
            message: 'Secure data received successfully',
            receivedData: data,
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({
            success: false,
            error: 'Invalid JSON body'
        }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}
