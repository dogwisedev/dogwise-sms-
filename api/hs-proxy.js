// api/hs-proxy.js
// Proxies HubSpot API calls from the browser (avoids CORS).
// Reads HUBSPOT_ACCESS_TOKEN from Vercel env vars.
// Usage: GET /api/hs-proxy?dealId=123456
//        GET /api/hs-proxy?action=createTask  (POST body: JSON task payload)

module.exports = async (req, res) => {
    // Allow requests from any origin (tighten this to your domain in production)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!token) {
        return res.status(500).json({ error: 'HUBSPOT_ACCESS_TOKEN not set in environment' });
    }

    const { dealId, action } = req.query;

    // ── GET deal data ─────────────────────────────────────────
    if (req.method === 'GET' && dealId) {
        try {
            const DEAL_PROPS = [
                'hubspot_owner_id',
                'k9___dog_name',
                'what_is_the_breed_of_the_dog_s__',
                'what_are_the_dog_s__age_s__',
                'note_from_customer',
                'additional_details',
                'location',
                'dealname'
            ].join(',');

            // Fetch deal + associations in parallel
            const [dealRes, assocRes] = await Promise.all([
                fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=${DEAL_PROPS}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/contacts`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            if (!dealRes.ok) {
                const err = await dealRes.text();
                return res.status(dealRes.status).json({ error: `HubSpot deal error: ${err}` });
            }

            const deal = await dealRes.json();
            let contact = null;
            let contactId = null;

            if (assocRes.ok) {
                const assoc = await assocRes.json();
                contactId = assoc.results?.[0]?.id;
                if (contactId) {
                    const cRes = await fetch(
                        `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,phone,zip_code`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (cRes.ok) contact = await cRes.json();
                }
            }

            return res.status(200).json({
                deal: deal.properties,
                dealId,
                contact: contact?.properties || null,
                contactId
            });

        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ── POST: create task ─────────────────────────────────────
    if (req.method === 'POST' && action === 'createTask') {
        try {
            const body = req.body;

            // Create the task
            const taskRes = await fetch('https://api.hubapi.com/crm/v3/objects/tasks', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ properties: body.properties })
            });

            if (!taskRes.ok) {
                const err = await taskRes.text();
                return res.status(taskRes.status).json({ error: `Task creation failed: ${err}` });
            }

            const task = await taskRes.json();

            // Associate task with deal if dealId provided
            if (task.id && body.dealId) {
                await fetch(
                    `https://api.hubapi.com/crm/v3/objects/tasks/${task.id}/associations/deals/${body.dealId}/task_to_deal`,
                    {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );
            }

            return res.status(200).json({ taskId: task.id, success: true });

        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(400).json({ error: 'Invalid request. Use GET ?dealId=123 or POST ?action=createTask' });
};
