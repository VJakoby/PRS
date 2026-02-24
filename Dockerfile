FROM node:20-slim

WORKDIR /app

# Install deps first for layer caching
COPY package*.json ./
RUN npm ci --only=production

# Copy app source
COPY . .

# Create cache dir (will be overridden by volume if mounted)
RUN mkdir -p cache && chown -R node:node /app

USER node

EXPOSE 3000

# Default command just starts server
CMD ["npm", "run", "start"]
