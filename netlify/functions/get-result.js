import { getStore } from '@netlify/blobs';

export default async (request) => {
    const jobId = new URL(request.url).searchParams.get('id');
    if (!jobId) {
        return new Response("Job ID required", { status: 400 });
    }

    const store = getStore({ name: "json-results" });
    const result = await store.get(jobId, { type: 'text' });

    if (result) {
        // Result is ready, send 200 OK
        return new Response(result, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } else {
        // Result is not ready yet, send 202 Accepted
        return new Response(JSON.stringify({ status: 'pending' }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};