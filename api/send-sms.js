export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // 1. Get the data HubSpot sends us
    const { objectId } = req.body; 
    
    try {
        // 2. Ask HubSpot for the Contact's details (Name & Phone)
        const hubspotResponse = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${objectId}?properties=firstname,phone`, {
            headers: {
                'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        const contactData = await hubspotResponse.json();
        
        const firstName = contactData.properties.firstname || "there";
        const phoneNumber = contactData.properties.phone;

        if (!phoneNumber) {
            return res.status(400).json({ message: 'No phone number found for this lead.' });
        }

        // 3. Prepare the "Alma" message
        const message = `Hi ${firstName}, it’s Alma from Dogwise Academy. I got your form asking for help with Dog training, call back when you can, or if texting’s easier I’d love to hear more about your dog.`;

        // 4. Send the text via OpenPhone
        const openPhoneResponse = await fetch('https://api.openphone.com/v1/messages', {
            method: 'POST',
            headers: {
                'Authorization': process.env.OPENPHONE_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: message,
                from: process.env.OPENPHONE_NUMBER_ID, // Your OpenPhone number ID
                to: [phoneNumber]
            })
        });

        return res.status(200).json({ status: 'Success', sentTo: phoneNumber });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to process lead' });
    }
}
