# Event-Driven Notification Microservice

Welcome to the Event-Driven Notification Microservice! This project demonstrates a robust, scalable backend architecture designed to handle asynchronous notifications using **Node.js**, **RabbitMQ**, and **MySQL**.

## Project Philosophy

The goal of this project was to build a system that is not only functional but also resilient and easy to maintain. By decoupling the API from the notification processing using a message queue, we ensure that:
*   **High Availability**: The API can accept requests even if the notification sender is temporarily slow or down.
*   **Reliability**: Failed notifications are not lost; they are retried automatically.
*   **Observability**: Every step of the process is tracked in the database.

## Tech Stack

*   **Runtime**: Node.js (v18)
*   **API Framework**: Express.js
*   **Message Broker**: RabbitMQ (handling queues, exchanges, and DLQ)
*   **Database**: MySQL 8.0 (persisting notification status)
*   **Containerization**: Docker & Docker Compose (for consistent environments)
*   **Testing**: Jest & Supertest

## Getting Started

### Prerequisites

*   Docker Desktop installed and running.
*   Node.js (optional, only if you want to run tests locally outside of Docker).

### Setup

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd Event-Driven-Notification-Microservice
    ```

2.  **Start the Application**:
    Run the following command to build and start all services:
    ```bash
    docker-compose up --build
    ```
    *Tip: It might take a minute for MySQL and RabbitMQ to fully initialize the first time.*

3.  **Verify It's Running**:
    *   **API Health Check**: Visit `http://localhost:3005/health`. You should see `{"status":"OK"}`.
    *   **RabbitMQ Dashboard**: Visit `http://localhost:15672` (Login: `guest`/`guest`).

## How to Test

### Manual Testing (Curl)

You can send a notification request using `curl` or Postman:

```bash
curl -X POST http://localhost:3005/events/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: supersecretkey" \
  -d '{
    "eventType": "user_signup",
    "timestamp": "2023-10-27T10:00:00Z",
    "payload": {
      "userId": "uuid-123",
      "email": "user@example.com",
      "username": "testuser"
    }
  }'
```

**Expected Response:**
```json
{
    "message": "Event accepted",
    "eventId": "...", 
    "status": "QUEUED"
}
```

### Automated Tests

We have a comprehensive test suite covering both unit logic and end-to-end integration.

**Run All Tests (Unit & Integration):**

To run the integration tests, ensure the Docker stack is up and running. Then execute:

```bash
# Verify the API Unit Tests
cd src/api && npm install && npm test

# Verify the Consumer Logic
cd src/consumer && npm install && npm test

# Run End-to-End Integration Tests
cd tests && npm install && npm test
```

## Architecture & Features

### 1. Asynchronous Ingestion
The API accepts requests immediately (HTTP 202) and pushes them to RabbitMQ. This ensures the API remains fast and responsive.

### 2. Idempotency
The Consumer Service checks the database using the unique `event_id` before processing. If an event was already processed, it is skipped. This prevents duplicate notifications.

### 3. Robust Retry Mechanism
We don't just fail; we retry smart.
*   **Transient Failures**: If the external notification service fails, the message is sent to a **Retry Exchange**.
*   **Exponential Backoff**: Messages wait in delay queues (1s, 5s, 30s) before being re-processed.
*   **Dead Letter Queue (DLQ)**: If a message fails after 3 attempts, it is moved to a DLQ for manual inspection.

## Troubleshooting

*   **"Connection refused" errors**: Ensure Docker is running. If you just started `docker-compose up`, wait a few seconds for MySQL and RabbitMQ to accept connections.
*   **Tests failing locally**: Make sure you run `npm install` in the respective directories (`src/api`, `src/consumer`, `tests`).


## Overview

This project implements a scalable microservices architecture where:
1.  **API Service**: Ingests events, validates them, and accepts them immediately (HTTP 202).
2.  **Message Queue (RabbitMQ)**: Decouples ingestion from processing reliability.
3.  **Consumer Service**: Processes events, handles retries with exponential backoff, and tracks status in a database.
4.  **Database (MySQL)**: Persists notification history and status.

## Technologies

-   **Runtime**: Node.js (v18)
-   **Framework**: Express.js
-   **Message Broker**: RabbitMQ
-   **Database**: MySQL 8.0
-   **Check Database:**
    Connect to MySQL (port 3307) or exec into container:
    ```bash
    mysql -h 127.0.0.1 -P 3307 -u root -p
    ```
-   **Containerization**: Docker & Docker Compose
-   **Testing**: Jest, Supertest

## Setup & Running

### Prerequisites
-   Docker and Docker Compose installed.
-   Node.js (for running local tests, optional).

### Quick Start
1.  **Clone the repository** (if not already done).
2.  **Start Services**:
    ```bash
    docker-compose up --build
    ```
    *This starts API, Consumer, RabbitMQ, and MySQL.*

3.  **Verify Services**:
    -   API Health: `http://localhost:3005/health`
    -   RabbitMQ Dashboard: `http://localhost:15672` (User: `guest`, Pass: `guest`)

## Usage

### Ingesting an Event
**Endpoint**: `POST http://localhost:3005/events/ingest`
**Headers**:
-   `Content-Type`: `application/json`
-   `X-API-Key`: `supersecretkey` (Configurable in `.env`)

**Body**:
```json
{
  "eventType": "user_signup",
  "timestamp": "2023-10-27T10:00:00Z",
  "payload": {
    "userId": "uuid-123",
    "email": "user@example.com",
    "username": "testuser"
  }
}
```

**Response**:
```json
{
    "message": "Event accepted",
    "eventId": "generated-uuid",
    "status": "QUEUED"
}
```

## Testing

### Unit Tests
Running unit tests works locally (requires dependencies installed):
```bash
# Install root dependencies (for running tests across repos if needed, or go into src/api)
cd src/api && npm install && npm test
cd ../consumer && npm install && npm test
```
*Note: The project structure separates dependencies. You can typically run tests inside the container or locally.*

### Integration Tests
To run End-to-End tests, the stack must be running:
1.  Ensure `docker-compose up` is running.
2.  Run the test script (requires local Node.js environment):
    ```bash
    # Install test dependencies
    cd tests
    npm install
    # Run E2E
    RUN_E2E=true npm test
    ```

## Architecture Details

### Event Flow
1.  **Producer**: API validates Schema (Joi) -> Publishes to `notification_events` queue.
2.  **Consumer**: Listens to `notification_events` -> Checks Idempotency (MySQL).
3.  **Processing**: Generates Notification -> Mocks Send -> Updates DB (`SENT`).

### Reliability & Retries
-   **Transient Failures**: If processing fails (e.g., 3rd party API down), the message is published to the `retry_exchange` with a delay (1s, 5s, 30s).
-   **Delayed Re-queue**: Messages sit in `delay_queue_X` until TTL expires, then Dead-Letter to `notification_events` Main Queue for re-processing.
-   **Dead Letter Queue (DLQ)**: After `MAX_RETRIES` (3), the message is moved to `notification_dead_letter_queue` and DB status set to `FAILED_DLQ`.

### Database Schema
-   **Table**: `notifications`
-   **Columns**: `id`, `event_id` (Unique), `status` (ENUM), `payload` (JSON), `attempt_count`, timestamps.

## Troubleshooting

-   **MySQL Connection Error**: Ensure the `mysql` container is healthy (`docker ps`). It takes a few seconds to initialize.
-   **RabbitMQ Connection Error**: The services depend on RabbitMQ being healthy. Restarting the consumer might be needed if it fails to connect initially (Docker restart policy handles this).
