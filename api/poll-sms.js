module.exports = async (req, res) => {
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

    let processedResults = [];

    try {
        // --- SWEEP 1: FIRST CONTACT TEXTS ---
        const firstSearch = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filterGroups: [{ filters: [{ propertyName: 'first_text_staus', operator: 'EQ', value: 'Ready' }] }],
                properties: ['lead_region', 'hubspot_owner_id', 'k9___dog_name'],
                limit: 10
            })
        });
        const firstData = await firstSearch.json();
        const firstDeals = firstData.results || [];

        // --- SWEEP 2: ONGOING CHECK-IN TEXTS ---
        const ongoingSearch = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filterGroups: [{ filters: [{ propertyName: 'ongoing_text_ready_to_send', operator: 'EQ', value: 'Ready' }] }],
                properties: ['lead_region', 'hubspot_owner_id', 'k9___dog_name', 'ongoing_text_email_template'],
                limit: 10
            })
        });
        const ongoingData = await ongoingSearch.json();
        const ongoingDeals = ongoingData.results || [];

        const allDealsToProcess = [
            ...firstDeals.map(d => ({ ...d, type: 'FIRST' })),
            ...ongoingDeals.map(d => ({ ...d, type: 'ONGOING' }))
        ];

        if (allDealsToProcess.length === 0) {
            return res.status(200).json({ message: "No deals found to process." });
        }

        for (const deal of allDealsToProcess) {
            const { lead_region, hubspot_owner_id, k9___dog_name, ongoing_text_email_template } = deal.properties;

            // Get Contact
            const assocRes = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}/associations/contacts`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            const assocData = await assocRes.json();
            const contactId = assocData.results?.[0]?.id;
            if (!contactId) continue;

            const contactRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,phone,email`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            const contactData = await contactRes.json();
            const { firstname, phone, email } = contactData.properties;
            if (!phone) continue;

            // Get Owner Name
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

            // Route & Message Logic
            const ownerIdStr = hubspot_owner_id?.toString();
            if (ownerIdStr && phoneMap[ownerIdStr]?.[lead_region]) {
                const senderPN = phoneMap[ownerIdStr][lead_region];
                const cleanPhone = `+1${phone.replace(/\D/g, '').slice(-10)}`;
                const dogReference = k9___dog_name || "your dog";

                let messageText = "";
                if (deal.type === 'FIRST') {
                    messageText = `Hi ${firstname || 'there'}! This is ${ownerName} from Dogwise Academy. We received your training request, I’d love to learn more about ${dogReference} and what you're working on. Would you prefer a quick call, or to chat here over text?`;
                } else {
                    // Ongoing Template Logic with Smart Replace
                    messageText = (ongoing_text_email_template || "")
                        .replace(/{firstname}/g, firstname || 'there')
                        .replace(/{dogname}/g, dogReference)
                        .replace(/{email}/g, email || 'your email')
                        .replace(/{ownername}/g, ownerName);
                }

                if (!messageText) continue;

                // Send to OpenPhone
                const opRes = await fetch('https://api.openphone.com/v1/messages', {
                    method: 'POST',
                    headers: { 'Authorization': OPENPHONE_API_KEY.trim(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: messageText, from: senderPN, to: [cleanPhone] })
                });

                if (opRes.ok) {
                    // Update appropriate status property
                    const updateProp = deal.type === 'FIRST' ? 'first_text_staus' : 'ongoing_text_ready_to_send';
                    await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}`, {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ properties: { [updateProp]: 'Sent' } })
                    });
                    processedResults.push({ dealId: deal.id, type: deal.type, status: "Sent" });
                }
            }
        }

        return res.status(200).json({ status: "Complete", processed: processedResults });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
