module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Use POST');
    const { HUBSPOT_ACCESS_TOKEN, OPENPHONE_API_KEY } = process.env;

    const phoneMap = {
        "75482998": { "East Coast": "PNItsh7bWS", "West Coast": "PNEcKEoyHX", "Florida": "PNceGqLFha", "Texas": "PNWT0HuaAy" }, // ALMA
        "89047041": { "East Coast": "PNhk6l4DYO", "West Coast": "PNYHBbwDjZ", "Florida": "PNDiOn7aMC" }, // EMMALEE
        "681113136": { "East Coast": "PNdBXv8eHM", "West Coast": "PN8eZbHA8A", "Florida": "PNaUeSGiQ2", "Texas": "PNHtnDN8cV" }, // ARI
        "527061938": { "East Coast": "PNmPKyUwAo", "West Coast": "PN0bfl92Xh", "Florida": "PN0XxYbla8" }, // LUISA
        "639328820": { "East Coast": "PNrjR3eNC1", "West Coast": "PNMsQ9zB00", "Florida": "PNjNCoDod1" }, // PAUL
        "414684321": { "East Coast": "PNCVRsFSYc", "West Coast": "PNo869d9E4", "Florida": "PN4SwnqKvp" }, // OLIVIA
        "89704240": { "East Coast": "PNItsh7bWS", "West Coast": "PNItsh7bWS", "Florida": "PNItsh7bWS" }, // KLOIE
    };

    try {
        const objectId = req.body.objectId || req.body.contactId;
        const isDealWorkflow = req.body.objectType === 'DEAL' || (req.body.objectId && !req.body.contactId);

        let contactId, lead_region, deal_owner_id;

        if (isDealWorkflow) {
            const dealRes = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${objectId}?properties=lead_region,hubspot_owner_id&associations=contacts`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            const dealData = await dealRes.json();
            lead_region = dealData.properties.lead_region;
            deal_owner_id = dealData.properties.hubspot_owner_id;
            contactId = dealData.associations?.contacts?.results[0]?.id;
        } else {
            contactId = objectId;
            const contactRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=hubspot_owner_id&associations=deals`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            const contactData = await contactRes.json();
            const dealId = contactData.associations?.deals?.results[0]?.id;
            if (dealId) {
                const dealRes = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=lead_region,hubspot_owner_id`, {
                    headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
                });
                const dealData = await dealRes.json();
                lead_region = dealData.properties.lead_region;
                deal_owner_id = dealData.properties.hubspot_owner_id;
            }
        }

        if (!contactId) return res.status(200).json({ message: "No contact identified" });

        const hsRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,phone`, {
            headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
        });
        const contactData = await hsRes.json();
        const { firstname, phone } = contactData.properties;

        let ownerName = "Alma";
        if (deal_owner_id) {
            const ownerRes = await fetch(`https://api.hubapi.com/crm/v3/owners/${deal_owner_id}`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            if (ownerRes.ok) {
                const ownerData = await ownerRes.json();
                ownerName = ownerData.firstName || "Alma";
            }
        }

        // --- FINAL ROUTING CHECK ---
        const region = lead_region || "East Coast";
        const ownerIdStr = deal_owner_id ? deal_owner_id.toString() : "75482998";
        
        // Match the 9-digit IDs from the log
        const ownerNumbers = phoneMap[ownerIdStr] || phoneMap["75482998"];
        const senderPN = ownerNumbers[region] || ownerNumbers["East Coast"];

        console.log(`FINAL ROUTE: Owner: ${ownerName} (${ownerIdStr}), Region: ${region}, PN: ${senderPN}`);

        const cleanPhone = `+1${phone.replace(/\D/g, '').slice(-10)}`;
        const opRes = await fetch('https://api.openphone.com/v1/messages', {
            method: 'POST',
            headers: { 
                'Authorization': OPENPHONE_API_KEY.trim(), 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: `Hi ${firstname || 'there'}, it's ${ownerName} from Dogwise Academy. I got your form asking for help with dog training. Call back when you can, or if texting's easier I'd love to hear more about your dog!`,
                from: senderPN, 
                to: [cleanPhone]
            })
        });

        const opData = await opRes.json();
        return res.status(200).json({ status: "Success", sentFrom: senderPN, openphone: opData });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
