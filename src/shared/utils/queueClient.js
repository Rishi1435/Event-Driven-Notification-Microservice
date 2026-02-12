const amqp = require('amqplib');

/**
 * QueueClient handles all RabbitMQ interactions.
 * It manages the connection, channel, and topology (exchanges/queues) setup.
 * 
 * Pattern:
 * - Main Queue: processing events.
 * - Retry Exchange (Topic): routing failed messages to delay queues.
 * - Delay Queues: hold messages for specific TTL, then DLX them back to Main Queue.
 * - DLQ: Final destination after max retries.
 */
class QueueClient {
    constructor(url) {
        this.url = url;
        this.connection = null;
        this.channel = null;

        // Define System Topology
        this.TOPOLOGY = {
            exchange: 'notification_exchange',
            retryExchange: 'retry_exchange',
            mainQueue: 'notification_events',
            dlq: 'notification_dead_letter_queue',
            delayQueues: [
                { name: 'delay_queue_1s', ttl: 1000 },
                { name: 'delay_queue_5s', ttl: 5000 },
                { name: 'delay_queue_30s', ttl: 30000 }
            ]
        };
    }

    /**
     * Establishes connection and channel to RabbitMQ.
     * Idempotent: checks if already connected.
     */
    async connect() {
        if (this.connection) return; // Already connected

        try {
            console.log(`Connecting to RabbitMQ at ${this.url}...`);
            this.connection = await amqp.connect(this.url);
            this.channel = await this.connection.createChannel();

            console.log('Connected to RabbitMQ successfully.');

            // Ensure topology exists
            await this.setupTopology();
        } catch (error) {
            console.error('RabbitMQ Connection Failed:', error.message);
            // In a real app, we might want to implement a connection retry loop here.
            throw error;
        }
    }

    /**
     * Asserts all Queues and Exchanges.
     */
    async setupTopology() {
        const ch = this.channel;
        if (!ch) throw new Error('Channel not initialized');

        // 1. Assert Main Queue
        // We do NOT set a DLX here because we manually handle retries. 
        // If we simply Nack(false), it would go to DLQ if we configured it here, 
        // but our retry logic involves publishing to a specific delay queue first.
        await ch.assertQueue(this.TOPOLOGY.mainQueue, {
            durable: true
        });

        // 2. Assert Dead Letter Queue (DLQ)
        await ch.assertQueue(this.TOPOLOGY.dlq, { durable: true });

        // 3. Assert Retry Exchange (Topic Type to route by delay duration)
        await ch.assertExchange(this.TOPOLOGY.retryExchange, 'topic', { durable: true });

        // 4. Setup Delay Queues
        // These queues hold messages for 'ttl' ms, then dead-letter them BACK to the Main Queue.
        for (const queue of this.TOPOLOGY.delayQueues) {
            await ch.assertQueue(queue.name, {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': '', // Default exchange
                    'x-dead-letter-routing-key': this.TOPOLOGY.mainQueue, // Route back to Main Queue
                    'x-message-ttl': queue.ttl
                }
            });

            // Bind Delay Queue to Retry Exchange
            // Routing key matches the delay (e.g., "retry.1000")
            await ch.bindQueue(queue.name, this.TOPOLOGY.retryExchange, `retry.${queue.ttl}`);
        }
    }

    /**
     * Publishes a new event to the Main Queue.
     */
    async publishEvent(event) {
        if (!this.channel) await this.connect();

        const buffer = Buffer.from(JSON.stringify(event));
        return this.channel.sendToQueue(this.TOPOLOGY.mainQueue, buffer, {
            persistent: true // Ensure message survives broker restart
        });
    }

    /**
     * Publishes a failed event to the Retry Exchange with a specific delay.
     * @param {Object} event - The event data.
     * @param {number} delayMs - Delay in milliseconds (1000, 5000, or 30000).
     */
    async publishToRetryExchange(event, delayMs) {
        if (!this.channel) await this.connect();

        const buffer = Buffer.from(JSON.stringify(event));

        // Determine routing key base on delay
        // Default to 30s if unknown
        let routingKey = 'retry.30000';
        if (delayMs <= 1000) routingKey = 'retry.1000';
        else if (delayMs <= 5000) routingKey = 'retry.5000';

        return this.channel.publish(this.TOPOLOGY.retryExchange, routingKey, buffer, {
            persistent: true
        });
    }

    /**
     * Moves a message to the Dead Letter Queue (DLQ).
     */
    async sendToDLQ(event) {
        if (!this.channel) await this.connect();

        const buffer = Buffer.from(JSON.stringify(event));
        return this.channel.sendToQueue(this.TOPOLOGY.dlq, buffer, {
            persistent: true
        });
    }

    async close() {
        if (this.channel) await this.channel.close();
        if (this.connection) await this.connection.close();
    }
}

module.exports = QueueClient;
