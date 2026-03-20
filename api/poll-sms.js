module.exports = async (req, res) => {
    // Note: We allow GET for manual testing in browser, cron uses GET by default
    const { HUBSPOT_ACCESS_TOKEN, OPENPHONE_API_KEY } = process.env;

    const phoneMap = {
        "75482998": { "East Coast": "PNItsh7bWS", "West Coast": "PNEcKEoyHX", "Florida": "PNceGqLFha", "Texas": "PNWT0HuaAy" }, // ALMA
        "89047041": { "East Coast": "PNhk6l4DYO", "West Coast": "PNYHBbwDjZ", "Florida": "PNDiOn7aMC", "Texas": "PNHtnDN8cV" }, // EMMALEE
        "681113136": { "East Coast": "PNdBXv8eHM", "West Coast": "PN8eZbHA8A", "Florida": "PNaUeSGiQ2", "Texas": "PNHtnDN8cV" }, // ARI
        "527061938": { "East Coast": "PNmPKyUwAo", "West Coast": "PN0bfl92Xh", "Florida": "PN0XxYbla8" }, // LUISA
        "639328820": { "East Coast": "PNrjR3eNC1", "West Coast": "PNMsQ9zB00", "Florida": "PNjNCoDod1", "CO": "PNdAOrWlkA" }, // PAUL
        "414684321": { "East Coast": "PNCVRsFSYc", "West Coast": "PNo869d9E4", "Florida": "PN4SwnqKvp" }, // OLIVIA
        "89704240": { "East Coast": "PNItsh7bWS", "West Coast": "PNItsh7bWS", "Florida": "PNItsh7bWS" }, // KLOIE
    };

    try {
        // 1. SEARCH: Find up to 10 deals where status is "Ready"
        const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filterGroups: [{
                    filters: [{ propertyName: 'first_text_staus', operator: 'EQ', value: 'Ready' }]
                }],
                properties: ['lead_region', 'hubspot_owner_id', 'k9___dog_name'],
                limit: 10
            })
        });

        const searchData = await searchRes.json();
        const deals = searchData.results || [];

        if (deals.length === 0) {
            return res.status(200).json({ message: "No deals found with status 'Ready'." });
        }

        let processed = [];

        for (const deal of deals) {
            const { lead_region, hubspot_owner_id, k9___dog_name } = deal.properties;

            // 2. GET CONTACT ASSOCIATION
            const assocRes = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}/associations/contacts`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            const assocData = await assocRes.json();
            const contactId = assocData.results?.[0]?.id;

            if (!contactId) {
                console.log(`No contact for deal ${deal.id}`);
                continue;
            }

            // 3. GET CONTACT DETAILS
            const hsRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,phone`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            const contactData = await hsRes.json();
            const { firstname, phone } = contactData.properties;

            if (!phone) {
                console.log(`No phone for contact ${contactId}`);
                continue;
            }

            // 4. OWNER NAME LOOKUP
            let ownerName = "Team";
            if (hubspot_owner_id) {
                const ownerRes = await fetch(`https://api.hubapi.com/crm/v3/owners/${hubspot_owner_id}`, {
                    headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
                });
                if (ownerRes.ok) {
                    const ownerData = await ownerRes.json();
                    ownerName = ownerData.firstName || "Team";
                }
            }

            // 5. ROUTING LOGIC
            const ownerIdStr = hubspot_owner_id ? hubspot_owner_id.toString() : null;
            if (ownerIdStr && phoneMap[ownerIdStr] && lead_region && phoneMap[ownerIdStr][lead_region]) {
                
                const senderPN = phoneMap[ownerIdStr][lead_region];
                const cleanPhone = `+1${phone.replace(/\D/g, '').slice(-10)}`;
                const dogReference = k9___dog_name ? k9___dog_name : "your dog";
                const messageText = `Hi ${firstname || 'there'}! This is ${ownerName} from Dogwise Academy. We received your training request, I’d love to learn more about ${dogReference} and what you're working on. Would you prefer a quick call, or to chat here over text?`;

                // 6. SEND VIA OPENPHONE
                const opRes = await fetch('https://api.openphone.com/v1/messages', {
                    method: 'POST',
                    headers: { 
                        'Authorization': OPENPHONE_API_KEY.trim(), 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        content: messageText,
                        from: senderPN, 
                        to: [cleanPhone]
                    })
                });

                if (opRes.ok) {
                    // 7. SUCCESS: Update HubSpot to "Sent"
                    await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ properties: { first_text_staus: 'Sent' } })
                    });
                    processed.push({ dealId: deal.id, status: "Sent" });
                } else {
                    // ERROR: Update HubSpot to "Error"
                    await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ properties: { first_text_staus: 'Error' } })
                    });
                }
            }
        }

        return res.status(200).json({ status: "Success", processedCount: processed.length, results: processed });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
