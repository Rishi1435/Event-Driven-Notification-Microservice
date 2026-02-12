const dotenv = require('dotenv');
const QueueClient = require('../shared/utils/queueClient');
const notificationService = require('./services/notificationService');
const databaseService = require('./services/databaseService');

dotenv.config();

const queueClient = new QueueClient(process.env.RABBITMQ_URL);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3');

async function startConsumer() {
    try {
        console.log('Starting Consumer Service...');
        await queueClient.connect();

        console.log('Consumer connected to RabbitMQ. Waiting for messages...');

        // Consume messages from the main notification queue
        queueClient.channel.consume(queueClient.TOPOLOGY.mainQueue, async (msg) => {
            if (!msg) return;

            const eventData = JSON.parse(msg.content.toString());
            const eventId = eventData.id || eventData.eventId;

            console.log(`Processing event: ${eventId}`);

            try {
                // 1. Idempotency Check: Verify if we've already handled this event
                const isProcessed = await databaseService.isEventProcessed(eventId);
                if (isProcessed) {
                    console.log(`Idempotency check: Event ${eventId} already processed. Skipping.`);
                    queueClient.channel.ack(msg);
                    return;
                }

                // 2. Track Processing Status
                // Create an initial record in the DB if it doesn't exist (or update if it does)
                await databaseService.createNotification(eventData);

                // 3. Generate Notification Payload
                const notificationPayload = notificationService.generatePayload(eventData);

                // 4. Send Notification (Simulated)
                await notificationService.sendNotification(notificationPayload);

                // 5. Update Status to SENT
                await databaseService.updateNotificationStatus(eventId, 'SENT');

                // 6. Acknowledge the message successfully
                queueClient.channel.ack(msg);
                console.log(`Successfully processed event ${eventId}`);

            } catch (error) {
                console.error(`Error processing event ${eventId}:`, error.message);

                // Retry Logic with Exponential Backoff
                const currentRetries = eventData.retryCount || 0;

                if (currentRetries < MAX_RETRIES) {
                    const nextRetry = currentRetries + 1;
                    eventData.retryCount = nextRetry;

                    // Calculate delay: 1st retry = 1s, 2nd = 5s, 3rd+ = 30s
                    let delay = 1000;
                    if (nextRetry === 2) delay = 5000;
                    if (nextRetry >= 3) delay = 30000;

                    console.log(`Scheduling retry for event ${eventId} (Attempt ${nextRetry}/${MAX_RETRIES}) in ${delay}ms`);

                    // Update status for observability
                    await databaseService.updateNotificationStatus(eventId, 'FAILED_RETRYING');

                    // Publish to Retry Exchange with delay
                    await queueClient.publishToRetryExchange(eventData, delay);

                    // Ack the original message so it leaves the main queue (new one will appear later)
                    queueClient.channel.ack(msg);
                } else {
                    // Max retries exhausted
                    console.error(`Max retries reached for event ${eventId}. Moving to Dead Letter Queue.`);

                    await databaseService.updateNotificationStatus(eventId, 'FAILED_DLQ');

                    // Manually send to DLQ (or rely on DLX if configured that way, but explicit is safer here)
                    await queueClient.sendToDLQ(eventData);

                    queueClient.channel.ack(msg);
                }
            }
        });

    } catch (error) {
        console.error('Fatal Consumer Startup Error:', error);
        process.exit(1);
    }
}

// Start the consumer worker
startConsumer();
