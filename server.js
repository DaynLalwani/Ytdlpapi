const express = require("express");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, "tmp");

// Ensure temp folder exists
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// Track deletion timers
const deleteTimers = new Map();

app.get("/stream/:id", async (req, res) => {
  console.log("Serving "+req)
  const videoId = req.params.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(TEMP_DIR, `${videoId}.mp4`);
  const cookieFilePath = path.join(TEMP_DIR, `cookies.txt`);

  // Ensure cookies ENV exists
  if (!process.env.YOUTUBE_COOKIES) {
    return res.status(500).send("YOUTUBE_COOKIES env variable not set");
  }

  // Write ENV cookies to temp file
  fs.writeFileSync(
    cookieFilePath,
    process.env.YOUTUBE_COOKIES.replace(/\\n/g, "\n")
  );

  // Download if not cached
  if (!fs.existsSync(outputPath)) {
    const args = [
      "--cookies", cookieFilePath,
      "-f", "bestvideo[height<=480]+bestaudio/best/best",
      "--merge-output-format", "mp4",
      "-o", outputPath,
      url
    ];

    try {
      await new Promise((resolve, reject) => {
        execFile("yt-dlp", args, (err, stdout, stderr) => {
          if (err) {
            console.error("yt-dlp error:", stderr.toString());
            reject(stderr.toString());
          } else {
            resolve();
          }
        });
      });
    } catch (err) {
      return res.status(500).send("Failed to fetch video using cookies");
    }
  }

  // Reset auto-delete timer (5 minutes)
  if (deleteTimers.has(videoId)) clearTimeout(deleteTimers.get(videoId));
  deleteTimers.set(videoId, setTimeout(() => {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    deleteTimers.delete(videoId);
  }, 5 * 60 * 1000));

  const stat = fs.statSync(outputPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = (end - start) + 1;

    const stream = fs.createReadStream(outputPath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4"
    });

    stream.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4"
    });

    fs.createReadStream(outputPath).pipe(res);
  }
});

app.listen(PORT, () => {
  console.log(`Streaming server running on port ${PORT}`);
});
