FROM node:18

WORKDIR /app

# Copy package.json
COPY src/consumer/package.json ./

# Install dependencies (including mysql2)
RUN npm install

# Copy shared utils
COPY src/shared ./src/shared

# Copy Consumer source
COPY src/consumer ./src/consumer

# Start Consumer
CMD ["node", "src/consumer/index.js"]
