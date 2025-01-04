# Use a slim base image
FROM node:22.12-slim

# Set the working directory *inside* the container
WORKDIR /app

# Copy package.json and package-lock.json (if it exists)
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy the application code from the correct directory
COPY . .

# Start the application
CMD ["node", "placeholder.js"]  
