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

//  HubSpot PATCH
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

// Groq Message Generator
async function getAiPersonalizedMessage(apiKey, data) {
    if (!apiKey) throw new Error("No API Key");

    const prompt = `
    You are ${data.ownerName} from Dogwise Academy. 
    Write a brief, friendly SMS to a new lead named ${data.firstName}.
    
    Context:
    - Dog: ${data.dogName} (${data.breed})
    - Age: ${data.age || 'not specified'}
    - Customer Notes: ${data.notes || 'none'}
    - Additional Details: ${data.details || 'none'}

    Guidelines:
    1. Start with "Hi ${data.firstName}, ${data.ownerName} from Dogwise Academy here."
    2. Mention their dog's age/breed. 
    3. Address specific concerns from their notes ONLY. DO NOT guess or assume problems if not explicitly mentioned in notes.
    4. Try to ask a specific question about the training they want, to increase interaction, if no info seen, a general dog training question
    5. Max 150 characters. Be punchy but fun and professional
    6. End with: "When's best for a call? Happy to text if you prefer."

    DO NOT use placeholders. DO NOT use emojis. Write ONLY the text message.
    `;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5
        })
    });

    if (!response.ok) throw new Error("Groq API Failed");
    const json = await response.json();
    return json.choices[0].message.content.trim();
}

module.exports = async (req, res) => {
    const { HUBSPOT_ACCESS_TOKEN, OPENPHONE_API_KEY, GROQ_API_KEY } = process.env;

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
                    'what_is_the_breed_of_the_dog_s__',
                    'note_from_customer',
                    'additional_details',
                    'what_are_the_dog_s__age_s__'
                ],
                limit: 20
            })
        });

        const firstData = await firstSearch.json();
        const deals = firstData.results || [];

        if (deals.length === 0) return res.status(200).json({ message: "No deals ready." });

        for (const deal of deals) {
            const props = deal.properties;
            const alreadyContacted = props.notes_last_contacted && props.notes_last_contacted !== "" && props.notes_last_contacted !== "null";

            if (alreadyContacted) {
                await updateDeal(deal.id, { first_text_staus: 'Sent' }, HUBSPOT_ACCESS_TOKEN);
                continue;
            }

            // Get Contact Info
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

            // Fix for Name Issue: REBECCA -> Rebecca
            const cleanFirstName = firstname ? firstname.charAt(0).toUpperCase() + firstname.slice(1).toLowerCase() : 'there';

            // Region & Owner Logic
            let zipDetectedRegion = null;
            const stateFromZip = await getLoc(zip_code);
            if (stateFromZip) {
                if (["TX", "OK", "AR"].includes(stateFromZip)) zipDetectedRegion = "Texas";
                else if (stateFromZip === "FL") zipDetectedRegion = "Florida";
                else if (stateFromZip === "CO") zipDetectedRegion = "CO";
                else if (["CA", "WA", "AZ", "OR", "NV"].includes(stateFromZip)) zipDetectedRegion = "West Coast";
                else zipDetectedRegion = "East Coast";
            }

            const finalRegion = props.lead_region || zipDetectedRegion || "East Coast";
            
            // ENSURE WE ONLY USE NUMBERS FROM THE DEAL OWNER
            const ownerId = props.hubspot_owner_id?.toString();
            let senderPN = phoneMap[ownerId]?.[finalRegion];

            // Fallback to Owner's East Coast number if region lookup fails
            if (!senderPN && phoneMap[ownerId]) {
                senderPN = phoneMap[ownerId]["East Coast"];
            }

            if (!senderPN) {
                await updateDeal(deal.id, { first_text_staus: 'Error' }, HUBSPOT_ACCESS_TOKEN);
                continue;
            }

            let ownerName = "Team";
            const ownerRes = await fetch(`https://api.hubapi.com/crm/v3/owners/${ownerId}`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            if (ownerRes.ok) {
                const ownerData = await ownerRes.json();
                ownerName = ownerData.firstName || "Team";
                if (ownerName === "Ariane") ownerName = "Ari";
            }

            const cleanPhone = `+1${phone.replace(/\D/g, '').slice(-10)}`;
            
            // --- MESSAGE GEN ---
            let finalMessage = "";
            
            // 1. Try AI
            if (GROQ_API_KEY) {
                try {
                    finalMessage = await getAiPersonalizedMessage(GROQ_API_KEY, {
                        firstName: cleanFirstName,
                        ownerName: ownerName,
                        dogName: props.k9___dog_name || 'your dog',
                        breed: props.what_is_the_breed_of_the_dog_s__ || 'dog',
                        age: props.what_are_the_dog_s__age_s__,
                        notes: props.note_from_customer,
                        details: props.additional_details
                    });
                } catch (aiErr) {
                    console.error("AI Error, switching to fallback:", aiErr.message);
                }
            }

            // 2. Fallback
            if (!finalMessage) {
                let rawDogInfo = props.k9___dog_name || (props.what_is_the_breed_of_the_dog_s__ ? `your ${props.what_is_the_breed_of_the_dog_s__}` : 'your dog');
                const dogInfo = rawDogInfo.charAt(0).toUpperCase() + rawDogInfo.slice(1).toLowerCase();
                finalMessage = `Hi ${cleanFirstName}! ${ownerName} from Dogwise Academy here. I saw your request for ${dogInfo}. When's a good time for a 5-min call to see how we can help? Happy to text too!`;
            }

            // Send OpenPhone
            const opRes = await fetch('https://api.openphone.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Authorization': OPENPHONE_API_KEY.trim(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: finalMessage,
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
