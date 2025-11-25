FROM node:20-alpine

# Install system dependencies and yt-dlp
RUN apk add --no-cache python3 py3-pip ffmpeg curl \
    && pip3 install yt-dlp

WORKDIR /app

# Copy package.json and install express
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Temporary folder for downloads
RUN mkdir -p /app/tmp

EXPOSE 3000
CMD ["node", "server.js"]
