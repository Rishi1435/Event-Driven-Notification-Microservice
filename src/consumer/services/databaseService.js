const mysql = require('mysql2/promise');

class DatabaseService {
    constructor() {
        this.pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }

    async isEventProcessed(eventId) {
        const [rows] = await this.pool.execute(
            'SELECT status FROM notifications WHERE event_id = ?',
            [eventId]
        );
        // If row exists and status is SENT, it's fully processed.
        // If status is FAILED_RETRYING, it's not "processed" in sense of completion, 
        // but we might want to handle it.
        // The index.js idempotency check says: "if isProcessed... skip".
        if (rows.length > 0) {
            const status = rows[0].status;
            return status === 'SENT' || status === 'FAILED_DLQ';
        }
        return false;
    }

    async createNotification(eventData) {
        try {
            await this.pool.execute(
                `INSERT INTO notifications (id, event_id, event_type, payload, status, attempt_count) 
                 VALUES (?, ?, ?, ?, 'QUEUED', 0)`,
                [
                    `notif-${eventData.id}`, // Reuse notification ID logic? Or separate UUID?
                    eventData.id,
                    eventData.eventType,
                    JSON.stringify(eventData.payload)
                ]
            );
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                // Ignore unique constraint violation if we are reprocessing
                console.log(`Notification record for event ${eventData.id} already exists.`);
            } else {
                throw error;
            }
        }
    }

    async updateNotificationStatus(eventId, status) {
        await this.pool.execute(
            'UPDATE notifications SET status = ?, last_attempt_timestamp = NOW(), attempt_count = attempt_count + 1 WHERE event_id = ?',
            [status, eventId]
        );
    }
}

module.exports = new DatabaseService();
