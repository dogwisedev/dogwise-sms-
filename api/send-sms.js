export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Use POST');

    const { HUBSPOT_ACCESS_TOKEN, OPENPHONE_API_KEY, OPENPHONE_NUMBER_ID } = process.env;

    try {
        const contactId = req.body.contactId || req.body.objectId;
        if (!contactId) return res.status(400).json({ error: "No Contact ID provided" });

        // 1. Fetch Contact from HubSpot
        const hsRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,phone,hubspot_owner_id`, {
            headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
        });
        const contactData = await hsRes.json();
        
        const { firstname, phone, hubspot_owner_id } = contactData.properties;
        if (!phone) return res.status(200).json({ message: "No phone number found." });

        // 2. Fetch Owner Name
        let ownerName = "Alma";
        if (hubspot_owner_id) {
            const ownerRes = await fetch(`https://api.hubapi.com/crm/v3/owners/${hubspot_owner_id}`, {
                headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN.trim()}` }
            });
            const ownerData = await ownerRes.json();
            ownerName = ownerData.firstName || "Alma";
        }

        const cleanPhone = `+1${phone.replace(/\D/g, '').slice(-10)}`;

        // 3. Send via OpenPhone
        const opRes = await fetch('https://api.openphone.com/v1/messages', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${OPENPHONE_API_KEY.trim()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: `Hi ${firstname || 'there'}, it’s ${ownerName} from Dogwise Academy. I got your form asking for help with Dog training, call back when you can, or if texting’s easier I’d love to hear more about your dog.`,
                from: OPENPHONE_NUMBER_ID.trim(),
                to: [cleanPhone]
            })
        });

        return res.status(200).json({ status: "Success" });

    } catch (err) {
        console.error("Error:", err.message);
        return res.status(500).json({ error: err.message });
    }
}
