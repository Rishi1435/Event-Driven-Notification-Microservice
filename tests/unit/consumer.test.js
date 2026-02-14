const notificationService = require('../../src/consumer/services/notificationService');

describe('Notification Service Unit Tests', () => {
    test('generatePayload should correctly transform event data', () => {
        const eventData = {
            id: 'event-123',
            eventType: 'user_signup',
            payload: {
                email: 'user@example.com',
                username: 'john_doe',
                userId: 'u-1'
            },
            timestamp: '2023-01-01T00:00:00Z'
        };

        const notification = notificationService.generatePayload(eventData);

        expect(notification.notificationId).toBe('notif-event-123');
        expect(notification.eventId).toBe('event-123');
        expect(notification.recipient).toBe('user@example.com');
        expect(notification.message).toContain('john_doe');
        expect(notification.message).toContain('user_signup');
    });

    test('sendNotification (Mock) should log to console', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const notification = {
            notificationId: '1',
            recipient: 'test@example.com',
            message: 'Hello'
        };

        await notificationService.sendNotification(notification);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Sending Notification'), expect.anything());
        consoleSpy.mockRestore();
    });

    test('sendNotification should throw error for failure simulation', async () => {
        const notification = {
            notificationId: '2',
            recipient: 'fail@example.com', // Triggers failure
            message: 'Hello'
        };

        await expect(notificationService.sendNotification(notification))
            .rejects.toThrow('Simulated External Service Failure');
    });
});
