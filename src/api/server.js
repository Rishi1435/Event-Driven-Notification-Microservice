const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const eventRoutes = require('./routes/eventRoutes');
const QueueClient = require('../shared/utils/queueClient');

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3000;

app.use(bodyParser.json());

app.use((req, res, next) => {
    // Health check endpoint should differ from the main API authentication
    if (req.path === '/health') return next();

    const apiKey = req.get('X-API-Key');
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
    }
    next();
});

// Setup RabbitMQ Client
const queueClient = new QueueClient(process.env.RABBITMQ_URL);

app.use((req, res, next) => {
    req.queueClient = queueClient;
    next();
});

app.use('/events', eventRoutes);

// Health Check Endpoint for Docker/Kubernetes probes
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

// Start the Server
async function startServer() {
    const MAX_RETRIES = 10; // Increased retries
    const RETRY_DELAY_MS = 5000;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            console.log(`Attempt ${i + 1}/${MAX_RETRIES}: Connecting to RabbitMQ...`);
            // Ensure we can connect to the Message Queue before accepting traffic
            await queueClient.connect();
            app.listen(PORT, () => {
                console.log(`API Service is up and running on port ${PORT}`);
            });
            return; // Success, exit loop
        } catch (error) {
            console.error(`Attempt ${i + 1}/${MAX_RETRIES} failed to connect to RabbitMQ:`, error.message);

            if (i === MAX_RETRIES - 1) {
                console.error('Critical Error: Failed to start API Service after multiple attempts:', error);
                process.exit(1);
            }

            // Wait before retrying
            console.log(`Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
}

// Only start the server if run directly (allows for testing)
if (require.main === module) {
    startServer();
}

module.exports = app;
