FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application files
COPY indexer.js .
COPY server.js .
COPY synonyms.json .
COPY scripts ./scripts/
COPY public ./public/

# Create directories
RUN mkdir -p data cache

# Expose port
EXPOSE 3002

# Start server
CMD ["npm", "start"]
