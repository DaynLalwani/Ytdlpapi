const express = require("express");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, "tmp");

// Ensure temp folder exists
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// Map to track deletion timers
const deleteTimers = new Map();

/**
 * Stream video to client with Range support
 */
app.get("/stream/:id", async (req, res) => {
  const videoId = req.params.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(TEMP_DIR, `${videoId}.mp4`);

  // If file doesn't exist, download it first
  if (!fs.existsSync(outputPath)) {
    const args = [
      "-f", "bestvideo[height<=480]+bestaudio/best/best",
      "--merge-output-format", "mp4",
      "-o", outputPath,
      url
    ];

    try {
      await new Promise((resolve, reject) => {
        execFile("yt-dlp", args, (err, stdout, stderr) => {
          if (err) reject(stderr.toString());
          else resolve();
        });
      });
    } catch (err) {
      console.error("yt-dlp error:", err);
      return res.status(500).send("Failed to fetch video");
    }
  }

  // Reset or start deletion timer (5 minutes)
  if (deleteTimers.has(videoId)) clearTimeout(deleteTimers.get(videoId));
  deleteTimers.set(videoId, setTimeout(() => {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    deleteTimers.delete(videoId);
  }, 5 * 60 * 1000));

  const stat = fs.statSync(outputPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    // Partial stream requested
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = (end - start) + 1;

    const file = fs.createReadStream(outputPath, { start, end });
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4"
    });
    file.pipe(res);
  } else {
    // Full file requested
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4"
    });
    fs.createReadStream(outputPath).pipe(res);
  }
});

app.listen(PORT, () => {
  console.log(`YouTube streaming server running on port ${PORT}`);
});
