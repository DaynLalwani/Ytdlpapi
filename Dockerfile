FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache python3 py3-pip ffmpeg curl bash

WORKDIR /app

# Create a Python virtual environment for yt-dlp
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip yt-dlp

# Add virtualenv bin to PATH
ENV PATH="/opt/venv/bin:$PATH"

# Copy package.json and install Express
COPY package*.json ./
RUN npm install
RUN npx playwright install chromium

# Copy application files
COPY . .

# Temporary folder for downloads
RUN mkdir -p /app/tmp

EXPOSE 3000
CMD ["node", "server.js"]
