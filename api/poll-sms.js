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

// 2. BACKUP: Location Property Resolver (NOW UPDATED WITH FULL EAST COAST LIST)
function resolveFromLocation(locString) {
    if (!locString) return null;
    const text = locString.toUpperCase();

    // Texas / West Coast / Florida / CO Priority Checks
    if (text.includes("TEXAS") || /\bTX\b/.test(text) || text.includes("OKLAHOMA") || /\bOK\b/.test(text) || text.includes("ARKANSAS") || /\bAR\b/.test(text)) return "Texas";
    if (text.includes("FLORIDA") || /\bFL\b/.test(text)) return "Florida";
    if (text.includes("COLORADO") || /\bCO\b/.test(text)) return "CO";
    if (text.includes("CALIFORNIA") || /\bCA\b/.test(text) || text.includes("WASHINGTON") || /\bWA\b/.test(text) || text.includes("ARIZONA") || /\bAZ\b/.test(text) || /\bOR\b/.test(text) || /\bNV\b/.test(text)) return "West Coast";
    
    // FULL EAST COAST SEARCH
    const eastCoastStates = [
        "CONNECTICUT", "DELAWARE", "GEORGIA", "ILLINOIS", "INDIANA", "IOWA", 
        "MAINE", "MARYLAND", "MASSACHUSETTS", "MICHIGAN", "NEW HAMPSHIRE", 
        "NEW JERSEY", "NEW YORK", "NORTH CAROLINA", "OHIO", "PENNSYLVANIA", 
        "RHODE ISLAND", "SOUTH CAROLINA", "VERMONT", "VIRGINIA", "WEST VIRGINIA", 
        "WISCONSIN", "DISTRICT OF COLUMBIA"
    ];
    
    const eastCoastAbbrev = [
        "CT", "DE", "GA", "IL", "IN", "IA", "ME", "MD", "MA", "MI", "NH", 
        "NJ", "NY", "NC", "OH", "PA", "RI", "SC", "VT", "VA", "WV", "WI", "DC"
    ];

    // Check full names
    if (eastCoastStates.some(state => text.includes(state))) return "East Coast";

    // Check abbreviations
    for (const abbrev of eastCoastAbbrev) {
        if (new RegExp(`\\b${abbrev}\\b`).test(text)) return "East Coast";
    }

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
        const firstSearch = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filterGroups: [{ filters: [{ propertyName: 'first_text_staus', operator: 'EQ', value: 'Ready' }] }],
                properties: ['hubspot_owner_id', 'k9___dog_name', 'location'],
                limit: 20
            })
        });
        const firstData = await firstSearch.json();
        const deals = firstData.results || [];

        if (deals.length === 0) return res.status(200).json({ message: "No deals ready." });

        for (const deal of deals) {
            const { hubspot_owner_id, k9___dog_name, location } = deal.properties;

            const assocRes = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}/associations/contacts`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            const assocData = await assocRes.json();
            const contactId = assocData.results?.[0]?.id;
            if (!contactId) continue;

            const contactRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,phone,zip_code`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            const contactData = await contactRes.json();
            const { firstname, phone, zip_code } = contactData.properties;

            if (!phone) continue;

            let finalRegion = null;
            const stateFromZip = await getLoc(zip_code);

            if (stateFromZip) {
                if (["TX", "OK", "AR"].includes(stateFromZip)) finalRegion = "Texas";
                else if (stateFromZip === "FL") finalRegion = "Florida";
                else if (stateFromZip === "CO") finalRegion = "CO";
                else if (["CA", "WA", "AZ", "OR", "NV"].includes(stateFromZip)) finalRegion = "West Coast";
                else finalRegion = "East Coast";
            } else {
                finalRegion = resolveFromLocation(location);
            }

            const ownerIdStr = hubspot_owner_id?.toString();
            const senderPN = finalRegion ? phoneMap[ownerIdStr]?.[finalRegion] : null;

            if (!senderPN) {
                console.log(`Failed to route deal ${deal.id}. Region: ${finalRegion}. Setting to Error.`);
                await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ properties: { first_text_staus: 'Error' } })
                });
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
        return res.status(500).json({ error: err.message });
    }
};
