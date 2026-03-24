const cache = {};

// 1. ZIP to State Fetcher
async function getLoc(zip) {
    if (!zip) return null;
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

// Helper to map State to Region
function mapStateToRegion(state) {
    if (["TX", "OK", "AR"].includes(state)) return "Texas";
    if (state === "FL") return "Florida";
    if (state === "CO") return "CO";
    if (["CA", "WA", "AZ", "OR", "NV"].includes(state)) return "West Coast";
    return "East Coast";
}

// Helper to find 5 digits in a string
function extractZip(strings) {
    for (const str of strings) {
        if (!str) continue;
        const match = str.toString().match(/\b\d{5}\b/);
        if (match) return match[0];
    }
    return null;
}

module.exports = async (req, res) => {
    const { HUBSPOT_ACCESS_TOKEN, OPENPHONE_API_KEY } = process.env;
    const authHeader = { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}`, 'Content-Type': 'application/json' };

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
    const processedContacts = new Set();

    try {
        // --- NEW STAGE: SORTING ---
        // Looks for deals you manually set to 'Yes'
        const sortSearch = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({
                filterGroups: [{ filters: [{ propertyName: 'sort_region', operator: 'EQ', value: 'Yes' }] }],
                properties: ['dealname', 'location'],
                limit: 50
            })
        });
        const sortData = await sortSearch.json();
        const dealsToSort = sortData.results || [];

        for (const deal of dealsToSort) {
            const zip = extractZip([deal.properties.location, deal.properties.dealname]);
            const state = await getLoc(zip);
            const region = state ? mapStateToRegion(state) : "East Coast";

            await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}`, {
                method: 'PATCH',
                headers: authHeader,
                body: JSON.stringify({ properties: { lead_region: region, sort_region: 'No' } })
            });
            console.log(`Sorted Deal ${deal.id} to ${region}`);
        }

        // --- NORMAL STAGE: SENDING ---
        const firstSearch = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({
                filterGroups: [{ filters: [{ propertyName: 'first_text_staus', operator: 'EQ', value: 'Ready' }] }],
                properties: ['hubspot_owner_id', 'k9___dog_name', 'lead_region'], 
                limit: 20
            })
        });
        const firstData = await firstSearch.json();
        const deals = firstData.results || [];

        if (deals.length === 0 && dealsToSort.length === 0) return res.status(200).json({ message: "Nothing to sort or send." });

        for (const deal of deals) {
            const { hubspot_owner_id, k9___dog_name, lead_region } = deal.properties;

            const assocRes = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}/associations/contacts`, { headers: authHeader });
            const assocData = await assocRes.json();
            const contactId = assocData.results?.[0]?.id;
            if (!contactId) continue;

            if (processedContacts.has(contactId)) {
                await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}`, {
                    method: 'PATCH',
                    headers: authHeader,
                    body: JSON.stringify({ properties: { first_text_staus: 'Sent' } })
                });
                continue;
            }

            const contactRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,phone,zip_code`, { headers: authHeader });
            const contactData = await contactRes.json();
            const { firstname, phone, zip_code } = contactData.properties;

            if (!phone) continue;

            // --- THE MISMATCH SAFEGUARD ---
            const contactState = await getLoc(zip_code);
            const contactRegion = contactState ? mapStateToRegion(contactState) : null;

            if (contactRegion && lead_region && contactRegion !== lead_region) {
                console.log(`Mismatch Safeguard: Blocking Deal ${deal.id}`);
                await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}`, {
                    method: 'PATCH',
                    headers: authHeader,
                    body: JSON.stringify({ properties: { first_text_staus: 'Error' } }) 
                });
                continue;
            }

            const finalRegion = lead_region || contactRegion;
            const ownerIdStr = hubspot_owner_id?.toString();
            const senderPN = phoneMap[ownerIdStr]?.[finalRegion];

            if (!senderPN) {
                await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}`, {
                    method: 'PATCH',
                    headers: authHeader,
                    body: JSON.stringify({ properties: { first_text_staus: 'Error' } })
                });
                continue;
            }

            let ownerName = "Team";
            const ownerRes = await fetch(`https://api.hubapi.com/crm/v3/owners/${hubspot_owner_id}`, { headers: authHeader });
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
                    headers: authHeader,
                    body: JSON.stringify({ properties: { first_text_staus: 'Sent' } })
                });
                processedContacts.add(contactId);
                processedResults.push({ id: deal.id, status: "Sent" });
            }
        }
        return res.status(200).json({ processed: processedResults });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
