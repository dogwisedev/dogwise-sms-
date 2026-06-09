const cache = {};

// ─── ZIP → State ───────────────────────────────────────────────────────────────
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

// ─── State → Region ────────────────────────────────────────────────────────────
function stateToRegion(state) {
    if (!state) return null;
    if (["TX", "OK", "AR", "KY"].includes(state)) return "Texas";
    if (state === "IL") return "Illinois";
    if (state === "FL") return "Florida";
    if (state === "CO") return "Colorado";
    if (["CA", "WA", "AZ", "OR", "NV"].includes(state)) return "West Coast";
    return "East Coast";
}

// ─── ZIP extractor (works on any string) ──────────────────────────────────────
function extractZip(str) {
    if (!str) return null;
    const match = str.toString().match(/\b\d{5}\b/);
    return match ? match[0] : null;
}

// ─── HubSpot PATCH ─────────────────────────────────────────────────────────────
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

// ─── AI Message (Alma only) ────────────────────────────────────────────────────
async function getAiPersonalizedMessage(apiKey, data) {
    if (!apiKey) throw new Error("No API Key");

    const dogDesc = [data.dogName !== 'your dog' ? data.dogName : null, data.breed, data.age]
        .filter(Boolean).join(', ');

    const hasRealNote = data.notes && data.notes !== 'NONE' &&
        data.notes.toLowerCase() !== data.breed?.toLowerCase() &&
        data.notes.toLowerCase() !== data.age?.toLowerCase();

    const prompt = `Write a first SMS from ${data.ownerName} at Dogwise Academy to ${data.firstName}, a new lead.

Dog: ${dogDesc || 'unknown'}
${hasRealNote ? `Their note: "${data.notes}"` : ''}

Rules:
- Start with "Hey ${data.firstName}, ${data.ownerName} from Dogwise Academy." — exactly that, nothing more for the intro
- Reference the dog naturally in one short clause
- ${hasRealNote ? `Acknowledge their specific concern briefly, then ask one follow-up question` : `Ask what specific struggle they want to work on, or if it's general obedience`}
- End with: "When's a good time for a quick call? Happy to text too."
- Max 220 characters total
- No emojis. No jargon. Sound like a real trainer texting between sessions.
- Output only the message. No quotes.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "You write short, natural SMS messages. Output only the message text. No quotes, no preamble." },
                { role: "user", content: prompt }
            ],
            temperature: 0.4,
            max_tokens: 120
        })
    });

    if (!response.ok) throw new Error("Groq API Failed");
    const json = await response.json();
    return json.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
}


// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — Set region on any new lead that doesn't have one yet
// Pipeline: 94161220  |  Stage "New Leads": 173324388
// ═══════════════════════════════════════════════════════════════════════════════
async function setRegionsForNewLeads(token) {
    const regionResults = [];

    const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token.trim()}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            filterGroups: [{
                filters: [
                    { propertyName: 'dealstage', operator: 'EQ', value: '173324388' },
                    { propertyName: 'lead_region', operator: 'NOT_HAS_PROPERTY' }
                ]
            }],
            properties: ['dealstage', 'lead_region', 'location', 'dealname'],
            limit: 50
        })
    });

    const searchData = await searchRes.json();
    const deals = searchData.results || [];

    if (deals.length === 0) {
        console.log("Phase 1: No unregioned new leads found.");
        return regionResults;
    }

    console.log(`Phase 1: Found ${deals.length} deal(s) needing a region.`);

    for (const deal of deals) {
        const assocRes = await fetch(
            `https://api.hubapi.com/crm/v3/objects/deals/${deal.id}/associations/contacts`,
            { headers: { 'Authorization': `Bearer ${token.trim()}` } }
        );
        const assocData = await assocRes.json();
        const contactId = assocData.results?.[0]?.id;

        if (!contactId) {
            console.log(`Phase 1: Deal ${deal.id} has no contact — skipping.`);
            continue;
        }

        const contactRes = await fetch(
            `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=zip_code`,
            { headers: { 'Authorization': `Bearer ${token.trim()}` } }
        );
        const contactData = await contactRes.json();

        const zipFromContact  = extractZip(contactData.properties?.zip_code);
        const zipFromLocation = extractZip(deal.properties?.location);
        const zipFromName     = extractZip(deal.properties?.dealname);

        const zip    = zipFromContact || zipFromLocation || zipFromName || null;
        const source = zipFromContact  ? 'contact.zip_code'
                     : zipFromLocation ? 'deal.location'
                     : zipFromName     ? 'deal.name'
                     : null;

        const state  = await getLoc(zip);
        const region = stateToRegion(state);

        if (!region) {
            await updateDeal(deal.id, { lead_region: 'No Zip Found' }, token);
            regionResults.push({ id: deal.id, region: 'No Zip Found' });
            console.log(`Phase 1: Deal ${deal.id} — no ZIP in any field, marked "No Zip Found".`);
            continue;
        }

        await updateDeal(deal.id, { lead_region: region }, token);
        regionResults.push({ id: deal.id, region });
        console.log(`Phase 1: Deal ${deal.id} → ${region} (ZIP ${zip} via ${source}, state ${state})`);
    }

    return regionResults;
}


// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — Send texts to deals HubSpot has marked Ready
// ═══════════════════════════════════════════════════════════════════════════════
async function sendReadyTexts(token, openphoneKey, groqKey) {
    const phoneMap = {
        "75482998":  { "East Coast": "PNItsh7bWS",  "West Coast": "PNEcKEoyHX",  "Florida": "PNceGqLFha",  "Texas": "PNWT0HuaAy",  "Illinois": "PNItsh7bWS" }, // Alma
        "89047041":  { "East Coast": "PNhk6l4DYO",  "West Coast": "PNYHBbwDjZ",  "Florida": "PNDiOn7aMC",  "Texas": "PNy8J5GulJ",  "Illinois": "PNhk6l4DYO" }, // Emmalee
        "89704240":  { "East Coast": "PNgxmHZMTt",  "West Coast": "PNhj6p3vi9",  "Florida": "PNnXbEIOB0",  "Texas": "PNByzfsgGI",  "Illinois": "PNgxmHZMTt" }, // Kloie
        "414684321": { "East Coast": "PNCVRsFSYc",  "West Coast": "PNo869d9E4",  "Florida": "PN4SwnqKvp",  "Colorado": "PNdAOrWlkA", "Texas": "PNeFWT5y8u",  "Illinois": "PNCVRsFSYc" }, // Olivia
        "527061938": { "East Coast": "PNmPKyUwAo",  "West Coast": "PN0bfl92Xh",  "Florida": "PN0XxYbla8",  "Texas": "PNgHkEgn8X",  "Illinois": "PNmPKyUwAo" }, // Luisa
        "639328820": { "East Coast": "PNrjR3eNC1",  "West Coast": "PNMsQ9zB00",  "Florida": "PNjNCoDod1",  "Texas": "",           "Illinois": "PNrjR3eNC1" }, // Paul
        "681113136": { "East Coast": "PNdBXv8eHM",  "West Coast": "PN8eZbHA8A",  "Florida": "PNaUeSGiQ2",  "Texas": "PNHtnDN8cV",  "Illinois": "PNdBXv8eHM" }, // Ariane
    };

    const processedResults  = [];
    const processedContacts = new Set();

    const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token.trim()}`,
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
                'location',
                'dealname',
                'notes_last_contacted',
                'what_is_the_breed_of_the_dog_s__',
                'note_from_customer',
                'additional_details',
                'what_are_the_dog_s__age_s__'
            ],
            limit: 20
        })
    });

    const searchData = await searchRes.json();
    const deals = searchData.results || [];

    if (deals.length === 0) {
        console.log("Phase 2: No deals marked Ready.");
        return processedResults;
    }

    console.log(`Phase 2: Found ${deals.length} deal(s) ready to text.`);

    for (const deal of deals) {
        const props = deal.properties;

        const alreadyContacted = props.notes_last_contacted &&
            props.notes_last_contacted !== "" &&
            props.notes_last_contacted !== "null";

        if (alreadyContacted) {
            await updateDeal(deal.id, { first_text_staus: 'Sent' }, token);
            continue;
        }

        const assocRes = await fetch(
            `https://api.hubapi.com/crm/v3/objects/deals/${deal.id}/associations/contacts`,
            { headers: { 'Authorization': `Bearer ${token.trim()}` } }
        );
        const assocData = await assocRes.json();
        const contactId = assocData.results?.[0]?.id;
        if (!contactId) continue;

        if (processedContacts.has(contactId)) {
            await updateDeal(deal.id, { first_text_staus: 'Sent' }, token);
            continue;
        }

        const contactRes = await fetch(
            `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,phone,zip_code`,
            { headers: { 'Authorization': `Bearer ${token.trim()}` } }
        );
        const contactData = await contactRes.json();
        const { firstname, phone, zip_code } = contactData.properties;

        if (!phone) {
            console.warn(`Phase 2: Deal ${deal.id} — no phone on contact, marking Error.`);
            await updateDeal(deal.id, { first_text_staus: 'Error' }, token);
            continue;
        }

        const cleanFirstName = firstname
            ? firstname.charAt(0).toUpperCase() + firstname.slice(1).toLowerCase()
            : 'there';

        const validRegions = ["East Coast", "West Coast", "Florida", "Texas", "Colorado", "Illinois"];
        let finalRegion = validRegions.includes(props.lead_region) ? props.lead_region : null;

        if (!finalRegion) {
            console.warn(`Phase 2: Deal ${deal.id} — no valid region, running fallback chain.`);
            const zip = extractZip(zip_code)
                     || extractZip(props.location)
                     || extractZip(props.dealname)
                     || null;
            const state = await getLoc(zip);
            finalRegion = stateToRegion(state) || "East Coast";
            await updateDeal(deal.id, { lead_region: finalRegion }, token);
        }

        const ownerId  = props.hubspot_owner_id?.toString();
        let senderPN   = phoneMap[ownerId]?.[finalRegion];

        if (!senderPN && phoneMap[ownerId]) {
            senderPN = phoneMap[ownerId]["East Coast"];
        }

        if (!senderPN) {
            await updateDeal(deal.id, { first_text_staus: 'Error' }, token);
            continue;
        }

        let ownerName = "Team";
        const ownerRes = await fetch(
            `https://api.hubapi.com/crm/v3/owners/${ownerId}`,
            { headers: { 'Authorization': `Bearer ${token.trim()}` } }
        );
        if (ownerRes.ok) {
            const ownerData = await ownerRes.json();
            ownerName = ownerData.firstName || "Team";
            if (ownerName === "Ariane") ownerName = "Ari";
        }

        const cleanPhone = `+1${phone.replace(/\D/g, '').slice(-10)}`;
        let finalMessage = "";

        const rawNotes = [props.note_from_customer, props.additional_details]
            .filter(n => n && n !== "null" && n !== "")
            .join(" | ");
        const cleanNotes = rawNotes.length > 2 ? rawNotes : "NONE";

        // AI message for Alma only
        if (ownerId === "75482998" && groqKey) {
            try {
                finalMessage = await getAiPersonalizedMessage(groqKey, {
                    firstName: cleanFirstName,
                    ownerName,
                    dogName: props.k9___dog_name || 'your dog',
                    breed:   props.what_is_the_breed_of_the_dog_s__ || '',
                    age:     props.what_are_the_dog_s__age_s__ || '',
                    notes:   cleanNotes
                });
            } catch (aiErr) {
                console.error("AI Error for Alma, using fallback:", aiErr.message);
            }
        }

        // Fallback message
        if (!finalMessage) {
            const dogInfo = props.k9___dog_name
                ? props.k9___dog_name.charAt(0).toUpperCase() + props.k9___dog_name.slice(1).toLowerCase()
                : (props.what_is_the_breed_of_the_dog_s__
                    ? `your ${props.what_is_the_breed_of_the_dog_s__.toLowerCase()}`
                    : "your dog");

            finalMessage = `Hi ${cleanFirstName}! ${ownerName} from Dogwise Academy here. I saw your request for ${dogInfo}. When's a good time for a 5-min call to see how we can help? Happy to text too!`;
        }

        // Send via OpenPhone
        const opRes = await fetch('https://api.openphone.com/v1/messages', {
            method: 'POST',
            headers: {
                'Authorization': openphoneKey.trim(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: finalMessage,
                from: senderPN,
                to: [cleanPhone]
            })
        });

        if (opRes.ok) {
            await updateDeal(deal.id, { first_text_staus: 'Sent' }, token);
            processedContacts.add(contactId);
            processedResults.push({ id: deal.id, region: finalRegion, status: "Sent" });
            console.log(`Phase 2: Deal ${deal.id} → text sent (${finalRegion}, owner ${ownerId})`);
        } else {
            const errBody = await opRes.text();
            console.error(`Phase 2: OpenPhone error for deal ${deal.id}:`, errBody);
            await updateDeal(deal.id, { first_text_staus: 'Error' }, token);
        }
    }

    return processedResults;
}


// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = async (req, res) => {
    const { HUBSPOT_ACCESS_TOKEN, OPENPHONE_API_KEY, GROQ_API_KEY } = process.env;

    try {
        const regionResults = await setRegionsForNewLeads(HUBSPOT_ACCESS_TOKEN);
        const sendResults   = await sendReadyTexts(HUBSPOT_ACCESS_TOKEN, OPENPHONE_API_KEY, GROQ_API_KEY);

        return res.status(200).json({
            phase1_regions_set: regionResults,
            phase2_texts_sent:  sendResults
        });
    } catch (err) {
        console.error("Fatal error:", err);
        return res.status(500).json({ error: err.message });
    }
};
