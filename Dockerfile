# Use a lightweight Node image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your code
COPY . .

# Match this to whatever port your app listens on
EXPOSE 3002

CMD ["npm", "start"]