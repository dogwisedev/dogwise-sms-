const cache = {};

// 1. ZIP to State Fetcher (Now with Regex cleaning)
async function getLoc(zip) {
    if (!zip) return null;
    
    // Extracts the first 5 digits found in the string (e.g., "Houston, TX 77083" -> "77083")
    const match = zip.toString().match(/\d{5}/);
    const cleanZip = match ? match[0] : null;

    if (!cleanZip) return null;
    if (cache[cleanZip]) return cache[cleanZip];

    try {
        const r = await fetch(`https://api.zippopotam.us/us/${cleanZip}`);
        if (!r.ok) return null;
        const d = await r.json();
        if (d.places?.[0]) {
            const stateAbb = d.places[0]['state abbreviation'];
            cache[cleanZip] = stateAbb;
            return stateAbb;
        }
    } catch (e) { console.error("ZIP API Error:", e); }
    return null;
}

module.exports = async (req, res) => {
    const { HUBSPOT_ACCESS_TOKEN, OPENPHONE_API_KEY } = process.env;

    const phoneMap = {
        "75482998": { "East Coast": "PNItsh7bWS", "West Coast": "PNEcKEoyHX", "Florida": "PNceGqLFha", "Texas": "PNWT0HuaAy" },
        "89047041": { "East Coast": "PNhk6l4DYO", "West Coast": "PNYHBbwDjZ", "Florida": "PNDiOn7aMC", "Texas": "PNHtnDN8cV" },
        "681113136": { "East Coast": "PNdBXv8eHM", "West Coast": "PN8eZbHA8A", "Florida": "PNaUeSGiQ2", "Texas": "PNHtnDN8cV" },
        "527061938": { "East Coast": "PNmPKyUwAo", "West Coast": "PN0bfl92Xh", "Florida": "PN0XxYbla8" },
        "639328820": { "East Coast": "PNrjR3eNC1", "West Coast": "PNMsQ9zB00", "Florida": "PNjNCoDod1", "CO": "PNdAOrWlkA" },
        "414684321": { "East Coast": "PNCVRsFSYc", "West Coast": "PNo869d9E4", "Florida": "PN4SwnqKvp" },
        "89704240": { "East Coast": "PNItsh7bWS", "West Coast": "PNItsh7bWS", "Florida": "PNItsh7bWS" },
    };

    let processedResults = [];

    try {
        console.log("--- STARTING ZIP-BASED SWEEP ---");

        const firstSearch = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filterGroups: [{ filters: [{ propertyName: 'first_text_staus', operator: 'EQ', value: 'Ready' }] }],
                properties: ['hubspot_owner_id', 'k9___dog_name'],
                limit: 20
            })
        });
        const firstData = await firstSearch.json();
        const deals = firstData.results || [];

        if (deals.length === 0) return res.status(200).json({ message: "No deals ready." });

        for (const deal of deals) {
            console.log(`--- Processing Deal: ${deal.id} ---`);
            const { hubspot_owner_id, k9___dog_name } = deal.properties;

            const assocRes = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}/associations/contacts`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            const assocData = await assocRes.json();
            const contactId = assocData.results?.[0]?.id;
            if (!contactId) { console.log("Skip: No Contact"); continue; }

            const contactRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,phone,zip_code,email`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            const contactData = await contactRes.json();
            const { firstname, phone, zip_code } = contactData.properties;

            if (!phone) { console.log("Skip: No Phone"); continue; }

            // 2. Resolve Region via Zip (Now uses cleaned 5-digit string)
            const stateAbb = await getLoc(zip_code);
            let finalRegion = "";

            if (!stateAbb) {
                finalRegion = "East Coast"; 
                console.log(`Zip ${zip_code} failed to resolve. Falling back to East Coast.`);
            } else if (["TX", "OK", "AR"].includes(stateAbb)) {
                finalRegion = "Texas";
            } else if (stateAbb === "FL") {
                finalRegion = "Florida";
            } else if (stateAbb === "CO") {
                finalRegion = "CO";
            } else if (["CA", "WA", "AZ", "OR", "NV"].includes(stateAbb)) {
                finalRegion = "West Coast";
            } else {
                finalRegion = "East Coast";
            }

            console.log(`Input: ${zip_code} -> State: ${stateAbb} -> Region: ${finalRegion}`);

            const ownerIdStr = hubspot_owner_id?.toString();
            const senderPN = phoneMap[ownerIdStr]?.[finalRegion];

            if (!senderPN) {
                console.log(`!!! ROUTING ERROR: No phone for Owner ${ownerIdStr} in ${finalRegion}`);
                continue;
            }

            let ownerName = "Team";
            const ownerRes = await fetch(`https://api.hubapi.com/crm/v3/owners/${hubspot_owner_id}`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            if (ownerRes.ok) {
                const ownerData = await ownerRes.json();
                ownerName = ownerData.firstName || "Team";
            }

            const cleanPhone = `+1${phone.replace(/\D/g, '').slice(-10)}`;
            const messageText = `Hi ${firstname || 'there'}! This is ${ownerName} from Dogwise Academy. We received your training request, I’d love to learn more about ${k9___dog_name || 'your dog'} and what you're working on. Would you prefer a quick call, or to chat here over text?`;

            const opRes = await fetch('https://api.openphone.com/v1/messages', {
                method: 'POST',
                headers: { 'Authorization': OPENPHONE_API_KEY.trim(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: messageText, from: senderPN, to: [cleanPhone] })
            });

            if (opRes.ok) {
                await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ properties: { first_text_staus: 'Sent' } })
                });
                processedResults.push({ id: deal.id, status: "Sent" });
            }
        }

        return res.status(200).json({ processed: processedResults });
    } catch (err) {
        console.log(`System Error: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
};
