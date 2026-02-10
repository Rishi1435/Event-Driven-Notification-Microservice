CREATE DATABASE IF NOT EXISTS `notification_db`;
USE `notification_db`;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` VARCHAR(255) PRIMARY KEY,
  `event_id` VARCHAR(255) NOT NULL UNIQUE,
  `event_type` VARCHAR(50) NOT NULL,
  `payload` JSON NOT NULL,
  `status` ENUM('QUEUED', 'SENT', 'FAILED_RETRYING', 'FAILED_DLQ') NOT NULL,
  `attempt_count` INT DEFAULT 0,
  `last_attempt_timestamp` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_event_id ON notifications(event_id);
CREATE INDEX idx_status ON notifications(status);
