/**
 * Service responsible for generating notification payloads and simulating delivery.
 */
class NotificationService {

    /**
     * Transforms the raw event data into a formatted notification payload.
     * @param {Object} eventData - The raw event object.
     * @returns {Object} The notification payload.
     */
    generatePayload(eventData) {
        return {
            notificationId: `notif-${eventData.id}`,
            eventId: eventData.id,
            recipient: eventData.payload.email,
            // In a real app, this message would use a template engine.
            message: `Hello ${eventData.payload.username}, welcome! (Type: ${eventData.eventType})`,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Simulates sending the notification to an external provider (e.g., SendGrid, Twilio).
     * Includes simulated latency and failure conditions for testing retry logic.
     * @param {Object} notification - The notification payload.
     */
    async sendNotification(notification) {
        // Simulate network latency (100ms)
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('Sending Notification:', JSON.stringify(notification, null, 2));

        // SIMULATION: Fail if the recipient email contains "fail"
        // This is used to demonstrate the retry mechanism and DLQ.
        if (notification && notification.recipient && notification.recipient.includes('fail')) {
            throw new Error('Simulated External Service Failure (Network Timeout)');
        }

        // Success
        return true;
    }
}

module.exports = new NotificationService();
