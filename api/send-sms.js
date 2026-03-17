const axios = require('axios');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const contactId = req.body.contactId || req.body.objectId;

    try {
        // 1. Fetch Contact AND the Deal Owner ID (hubspot_owner_id)
        const hsRes = await axios.get(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,phone,hubspot_owner_id`, {
            headers: { 'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` }
        });

        const contactProps = hsRes.data.properties;
        const customerName = contactProps.firstname || "there";
        const rawPhone = contactProps.phone;
        const ownerId = contactProps.hubspot_owner_id;

        if (!rawPhone) return res.status(200).json({ message: "No phone number found." });

        // 2. Fetch the Owner's First Name
        let ownerFirstName = "Alma"; // Fallback if no owner is assigned
        if (ownerId) {
            const ownerRes = await axios.get(`https://api.hubapi.com/crm/v3/owners/${ownerId}`, {
                headers: { 'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` }
            });
            ownerFirstName = ownerRes.data.firstName || "Alma";
        }

        // 3. Clean Phone Number
        const cleanPhone = `+1${rawPhone.replace(/\D/g, '').slice(-10)}`;

        // 4. The Personalized Message
        const message = `Hi ${customerName}, it’s ${ownerFirstName} from Dogwise Academy. I got your form asking for help with Dog training, call back when you can, or if texting’s easier I’d love to hear more about your dog.`;

        // 5. Send via OpenPhone
        await axios.post('https://api.openphone.com/v1/messages', {
            content: message,
            from: process.env.OPENPHONE_NUMBER_ID,
            to: [cleanPhone]
        }, {
            headers: { 'Authorization': `Bearer ${process.env.OPENPHONE_API_KEY}` }
        });

        return res.status(200).json({ status: "Success", sentTo: cleanPhone, sentBy: ownerFirstName });

    } catch (err) {
        console.error("Error details:", err.response?.data || err.message);
        return res.status(500).json({ error: "Failed to send personalized SMS" });
    }
}
