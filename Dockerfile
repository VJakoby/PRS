FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Ensure latest npm version
RUN npm install -g npm@latest

# Install production dependencies only
RUN npm ci --omit=dev --production

# Copy application files
COPY indexer.js .
COPY server.js .
COPY synonyms.json .
COPY public ./public/

# Create directories
RUN mkdir -p data cache

# Expose port
EXPOSE 3002

# Start server
CMD ["npm", "start"]
