FROM node:18

WORKDIR /app

# Copy package.json from the API directory
COPY src/api/package.json ./

# Install dependencies
RUN npm install

# Copy shared source code
COPY src/shared ./src/shared

# Copy API source code
COPY src/api ./src/api

# Expose API Port
EXPOSE 3000

# Start command (relative to WORKDIR)
CMD ["node", "src/api/server.js"]
