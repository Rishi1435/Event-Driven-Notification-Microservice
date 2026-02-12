const express = require('express');
const router = express.Router();
const eventSchema = require('../validation/eventSchema');
const { v4: uuidv4 } = require('uuid'); // We might need this if we assign IDs, but payload has one? 
// Prompt says: "eventData has a unique ID".
// Let's assume the user sends it, or we generate if missing? 
// Schema says userId, email, username in payload. Event has eventType, timestamp, payload.
// It doesn't explicitly have an 'id' at the top level in the example JSON.
// However, the DB schema has `event_id` unique.
// Recommendation: We should assign a unique event ID here if not present, to ensure idempotency tracking works reliably.
// But the schema example in prompt doesn't show an ID field in the request.
// So we will generate one here and attach it to the message sent to MQ.

router.post('/ingest', async (req, res) => {
    try {
        // 1. Validate Schema
        const { error, value } = eventSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: `Invalid Request: ${error.details[0].message}` });
        }

        // 2. Prepare Event Data (Add trace ID)
        const eventId = require('crypto').randomUUID();
        const eventData = {
            ...value,
            id: eventId // Add ID for tracking/idempotency
        };

        // 3. Publish to MQ
        await req.queueClient.publishEvent(eventData);

        // 4. Return Accepted
        res.status(202).json({
            message: 'Event accepted',
            eventId: eventId,
            status: 'QUEUED'
        });

    } catch (err) {
        console.error('Ingest Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
