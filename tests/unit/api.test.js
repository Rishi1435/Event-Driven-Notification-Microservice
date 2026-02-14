const request = require('supertest');
const app = require('../../src/api/server'); // Adjust path as needed
const QueueClient = require('../../src/shared/utils/queueClient');

// Mock QueueClient
jest.mock('../../src/shared/utils/queueClient');

describe('API Service Unit Tests', () => {
    let mockPublishEvent;

    beforeEach(() => {
        // Reset mocks
        mockPublishEvent = jest.fn().mockResolvedValue(true);
        QueueClient.prototype.publishEvent = mockPublishEvent;
        QueueClient.prototype.connect = jest.fn().mockResolvedValue(true);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // Test API Key Auth
    test('POST /events/ingest should return 401 if API Key is missing', async () => {
        const res = await request(app)
            .post('/events/ingest')
            .send({});
        expect(res.statusCode).toBe(401);
    });

    test('POST /events/ingest should return 401 if API Key is invalid', async () => {
        const res = await request(app)
            .post('/events/ingest')
            .set('X-API-Key', 'wrong-key')
            .send({});
        expect(res.statusCode).toBe(401);
    });

    // Test Validation
    test('POST /events/ingest should return 400 for invalid schema', async () => {
        const invalidPayload = {
            eventType: 'test_event',
            // Missing timestamp
            payload: { userId: '123' }
        };

        const res = await request(app)
            .post('/events/ingest')
            .set('X-API-Key', 'supersecretkey')
            .send(invalidPayload);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain('Invalid Request');
        expect(mockPublishEvent).not.toHaveBeenCalled();
    });

    // Test Success
    test('POST /events/ingest should return 202 and publish event on success', async () => {
        const validEvent = {
            eventType: 'user_signup',
            timestamp: new Date().toISOString(),
            payload: {
                userId: 'uuid-123',
                email: 'test@example.com',
                username: 'testuser'
            }
        };

        const res = await request(app)
            .post('/events/ingest')
            .set('X-API-Key', 'supersecretkey')
            .send(validEvent);

        expect(res.statusCode).toBe(202);
        expect(res.body.status).toBe('QUEUED');
        expect(res.body.eventId).toBeDefined();

        // Verify MQ publish
        expect(mockPublishEvent).toHaveBeenCalledTimes(1);
        const publishedEvent = mockPublishEvent.mock.calls[0][0];
        expect(publishedEvent.id).toBeDefined(); // Generated ID
        expect(publishedEvent.eventType).toBe(validEvent.eventType);
    });
});
