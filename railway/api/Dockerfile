# Use the official lightweight Node.js 18 Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy application source
COPY server.js ./

# Copy the status-page static assets so the server can serve them
COPY ../status-page ./status-page

# Expose the API port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
