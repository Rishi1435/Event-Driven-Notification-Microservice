const request = require('supertest');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Configuration for E2E
const API_URL = `http://localhost:${process.env.API_PORT || 3000}`;
const API_KEY = process.env.API_KEY || 'supersecretkey';

// Only run if ENVIRONMENT is E2E
const runE2E = process.env.RUN_E2E === 'true' || true;

(runE2E ? describe : describe.skip)('End-to-End Integration Tests', () => {
    let dbConnection;

    beforeAll(async () => {
        // Retry DB connection until ready
        let connected = false;
        let attempts = 0;
        while (!connected && attempts < 10) {
            try {
                dbConnection = await mysql.createConnection({
                    host: process.env.MYSQL_HOST || 'localhost',
                    user: 'root',
                    password: process.env.MYSQL_ROOT_PASSWORD || 'rootpassword',
                    database: process.env.MYSQL_DATABASE || 'notification_db',
                    port: process.env.MYSQL_PORT || 3306
                });
                connected = true;
                console.log('Connected to Test Database');
            } catch (err) {
                console.log('Waiting for Database...');
                await new Promise(r => setTimeout(r, 2000));
                attempts++;
            }
        }
        if (!connected) throw new Error('Could not connect to Database after multiple attempts');
    }, 30000); // 30s timeout for DB connection

    afterAll(async () => {
        if (dbConnection) await dbConnection.end();
    });

    test('Full Flow: Ingest Event -> Process -> Sent Status', async () => {
        const eventPayload = {
            eventType: 'e2e_test_event',
            timestamp: new Date().toISOString(),
            payload: {
                userId: 'user-e2e-001',
                email: 'e2e-user@example.com',
                username: 'E2E_Tester'
            }
        };

        // 1. Ingest Event via API
        console.log('Sending Event to API...');
        const res = await request(API_URL)
            .post('/events/ingest')
            .set('X-API-Key', API_KEY)
            .send(eventPayload);

        expect(res.statusCode).toBe(202);
        const eventId = res.body.eventId;
        console.log(`Event Accepted. ID: ${eventId}`);
        expect(eventId).toBeDefined();

        // 2. Poll Database for Completion
        console.log('Polling Database for status update...');
        let status = 'QUEUED';
        let retries = 0;

        // Wait up to 30 seconds for the worker to process
        while (status !== 'SENT' && retries < 30) {
            await new Promise(r => setTimeout(r, 1000));
            const [rows] = await dbConnection.execute(
                'SELECT status FROM notifications WHERE event_id = ?',
                [eventId]
            );
            if (rows.length > 0) {
                status = rows[0].status;
                // console.log(`Current Status: ${status}`);
            }
            if (status === 'SENT') break;
            retries++;
        }

        expect(status).toBe('SENT');
        console.log('Test Passed: Event status transitioned to SENT');
    }, 40000);
});
