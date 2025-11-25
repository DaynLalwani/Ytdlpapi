# Use Node.js Alpine for small image size
FROM node:20-alpine

# Install system dependencies for yt-dlp
RUN apk add --no-cache python3 ffmpeg curl

WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm install

# Copy rest of the files
COPY . .

# Create temporary folder
RUN mkdir -p /app/tmp

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
