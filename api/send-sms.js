module.exports = async (req, res) => {
    // 1. Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).send('Use POST');
    }

    const { HUBSPOT_ACCESS_TOKEN, OPENPHONE_API_KEY } = process.env;

    try {
        const contactId = req.body.contactId || req.body.objectId;
        if (!contactId) {
            return res.status(400).json({ error: "No Contact ID provided" });
        }

        // 2. Fetch Contact from HubSpot
        const hsRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,phone,hubspot_owner_id`, {
            headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
        });
        
        if (!hsRes.ok) {
            const errorData = await hsRes.json();
            console.error("HubSpot Error:", errorData);
            return res.status(hsRes.status).json({ error: "Failed to fetch contact from HubSpot" });
        }

        const contactData = await hsRes.json();
        const { firstname, phone, hubspot_owner_id } = contactData.properties;

        if (!phone) {
            return res.status(200).json({ message: "No phone number found for this contact." });
        }

        // 3. Fetch Owner Name (or default to Alma)
        let ownerName = "Alma";
        if (hubspot_owner_id) {
            const ownerRes = await fetch(`https://api.hubapi.com/crm/v3/owners/${hubspot_owner_id}`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            if (ownerRes.ok) {
                const ownerData = await ownerRes.json();
                ownerName = ownerData.firstName || "Alma";
            }
        }

        // 4. Clean and format the phone number
        const cleanPhone = `+1${phone.replace(/\D/g, '').slice(-10)}`;

        // 5. Send via OpenPhone
        const opRes = await fetch('https://api.openphone.com/v1/messages', {
            method: 'POST',
            headers: { 
                'Authorization': OPENPHONE_API_KEY.trim(), 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: `Hi ${firstname || 'there'}, it's ${ownerName} from Dogwise Academy. I got your form asking for help with dog training. Call back when you can, or if texting's easier I'd love to hear more about your dog!`,
                from: "+16465767764", // Direct phone number bypass
                to: [cleanPhone]
            })
        });

        const opData = await opRes.json();
        
        // Log the response so we can see it in Vercel
        console.log("OpenPhone API Response:", opData);

        return res.status(200).json({ 
            status: "Success", 
            sentTo: cleanPhone,
            openphone: opData 
        });

    } catch (err) {
        console.error("Runtime Error:", err.message);
        return res.status(500).json({ error: err.message });
    }
};
