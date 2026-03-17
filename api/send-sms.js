import axios from 'axios';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Use POST');

    if (!process.env.HUBSPOT_ACCESS_TOKEN || !process.env.OPENPHONE_API_KEY || !process.env.OPENPHONE_NUMBER_ID) {
        console.error("Missing Environment Variables");
        return res.status(500).json({ error: "Server Configuration Error" });
    }

    try {
        const contactId = req.body.contactId || req.body.objectId;
        if (!contactId) return res.status(400).json({ error: "No Contact ID provided" });

        // 1. Fetch Contact & Owner ID
        const hsRes = await axios.get(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,phone,hubspot_owner_id`, {
            headers: { 'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN.trim()}` }
        });

        const { firstname, phone, hubspot_owner_id } = hsRes.data.properties;
        
        if (!phone) return res.status(200).json({ message: "No phone number found." });

        // 2. Fetch Owner's First Name
        let ownerName = "Alma"; 
        if (hubspot_owner_id) {
            try {
                const ownerRes = await axios.get(`https://api.hubapi.com/crm/v3/owners/${hubspot_owner_id}`, {
                    headers: { 'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN.trim()}` }
                });
                ownerName = ownerRes.data.firstName || "Alma";
            } catch (e) {
                console.log("Owner fetch failed, using fallback.");
            }
        }

        const cleanPhone = `+1${phone.replace(/\D/g, '').slice(-10)}`;

        // 3. Send via OpenPhone
        await axios.post('https://api.openphone.com/v1/messages', {
            content: `Hi ${firstname || 'there'}, it’s ${ownerName} from Dogwise Academy. I got your form asking for help with Dog training, call back when you can, or if texting’s easier I’d love to hear more about your dog.`,
            from: process.env.OPENPHONE_NUMBER_ID.trim(),
            to: [cleanPhone]
        }, {
            headers: { 
                'Authorization': `Bearer ${process.env.OPENPHONE_API_KEY.trim()}`,
                'Content-Type': 'application/json'
            }
        });

        return res.status(200).json({ status: "Success" });

    } catch (err) {
        console.error("Runtime Error:", err.response?.data || err.message);
        return res.status(500).json({ error: "Check Vercel logs" });
    }
}
