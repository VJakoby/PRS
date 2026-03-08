FROM node:20-alpine
WORKDIR /app

# Install deps first for layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source
COPY . .

# Create necessary dirs and lock down ownership
RUN mkdir -p cache data/cache/online && \
    chown -R node:node /app

USER node
EXPOSE 3002
CMD ["npm", "run", "start"]