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

// 🔧 helper: safe HubSpot PATCH
async function updateDeal(dealId, properties, token) {
    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token.trim()}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ properties })
    });
    return res.ok;
}

module.exports = async (req, res) => {
    const { HUBSPOT_ACCESS_TOKEN, OPENPHONE_API_KEY } = process.env;

    const phoneMap = {
        "75482998": { "East Coast": "PNItsh7bWS", "West Coast": "PNEcKEoyHX", "Florida": "PNceGqLFha", "Texas": "PNWT0HuaAy" }, // Alma
        "89047041": { "East Coast": "PNhk6l4DYO", "West Coast": "PNYHBbwDjZ", "Florida": "PNDiOn7aMC", "Texas": "PNy8J5GulJ" }, // Emmalee
        "89704240": { "East Coast": "PNgxmHZMTt", "West Coast": "PNhj6p3vi9", "Florida": "PNnXbEIOB0", "Texas": "PNByzfsgGI" }, // Kloie
        "414684321": { "East Coast": "PNCVRsFSYc", "West Coast": "PNo869d9E4", "Florida": "PN4SwnqKvp", "Texas": "PNeFWT5y8u" }, // Olivia
        "527061938": { "East Coast": "PNmPKyUwAo", "West Coast": "PN0bfl92Xh", "Florida": "PN0XxYbla8", "Texas": "PNgHkEgn8X" }, // Luisa (Ari's)
        "639328820": { "East Coast": "PNrjR3eNC1", "West Coast": "PNMsQ9zB00", "Florida": "PNjNCoDod1", "CO": "PNdAOrWlkA", "Texas": "" }, // Paul (Alma's)
        "681113136": { "East Coast": "PNdBXv8eHM", "West Coast": "PN8eZbHA8A", "Florida": "PNaUeSGiQ2", "Texas": "PNHtnDN8cV" }, // Ariane
    };

    let processedResults = [];
    const processedContacts = new Set();

    try {
        const firstSearch = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filterGroups: [{
                    filters: [{ propertyName: 'first_text_staus', operator: 'EQ', value: 'Ready' }]
                }],
                properties: [
                    'hubspot_owner_id', 
                    'k9___dog_name', 
                    'lead_region', 
                    'notes_last_contacted', 
                    'what_is_the_breed_of_the_dog_s__'
                ],
                limit: 20
            })
        });

        const firstData = await firstSearch.json();
        const deals = firstData.results || [];

        if (deals.length === 0) return res.status(200).json({ message: "No deals ready." });

        for (const deal of deals) {
            const {
                hubspot_owner_id,
                k9___dog_name,
                lead_region,
                notes_last_contacted,
                what_is_the_breed_of_the_dog_s__: breed 
            } = deal.properties;

            const alreadyContacted = notes_last_contacted && notes_last_contacted !== "" && notes_last_contacted !== "null";

            if (alreadyContacted) {
                await updateDeal(deal.id, { first_text_staus: 'Sent' }, HUBSPOT_ACCESS_TOKEN);
                continue;
            }

            const assocRes = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${deal.id}/associations/contacts`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            const assocData = await assocRes.json();
            const contactId = assocData.results?.[0]?.id;
            if (!contactId) continue;

            if (processedContacts.has(contactId)) {
                await updateDeal(deal.id, { first_text_staus: 'Sent' }, HUBSPOT_ACCESS_TOKEN);
                continue;
            }

            const contactRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,phone,zip_code`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            const contactData = await contactRes.json();
            const { firstname, phone, zip_code } = contactData.properties;

            if (!phone) continue;

            let zipDetectedRegion = null;
            const stateFromZip = await getLoc(zip_code);
            if (stateFromZip) {
                if (["TX", "OK", "AR"].includes(stateFromZip)) zipDetectedRegion = "Texas";
                else if (stateFromZip === "FL") zipDetectedRegion = "Florida";
                else if (stateFromZip === "CO") zipDetectedRegion = "CO";
                else if (["CA", "WA", "AZ", "OR", "NV"].includes(stateFromZip)) zipDetectedRegion = "West Coast";
                else zipDetectedRegion = "East Coast";
            }

            const finalRegion = lead_region || zipDetectedRegion;
            const senderPN = phoneMap[hubspot_owner_id?.toString()]?.[finalRegion];

            if (!senderPN) {
                await updateDeal(deal.id, { first_text_staus: 'Error' }, HUBSPOT_ACCESS_TOKEN);
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
            
            // ✅ PRIORITY: Dog Name > Breed > "your dog"
            const dogInfo = k9___dog_name || (breed ? `your ${breed}` : 'your dog');

            // ✅ UPDATED TEXT
            const messageText = `Hi ${firstname || 'there'}! This is ${ownerName} from Dogwise Academy. I just reviewed the information you shared about ${dogInfo}. I have a few recommendations that could help. A quick 5–10 min call is usually easiest to walk you through it, just to give you some clarity. Do you have a few minutes today?`;

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
                await updateDeal(deal.id, { first_text_staus: 'Sent' }, HUBSPOT_ACCESS_TOKEN);
                processedContacts.add(contactId);
                processedResults.push({ id: deal.id, status: "Sent" });
            } else {
                await updateDeal(deal.id, { first_text_staus: 'Error' }, HUBSPOT_ACCESS_TOKEN);
            }
        }

        return res.status(200).json({ processed: processedResults });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
