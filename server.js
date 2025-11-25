const express = require("express");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, "tmp");

// Ensure temp folder exists
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// Map to keep track of timers
const deleteTimers = new Map();

app.get("/download/:id", (req, res) => {
  const videoId = req.params.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(TEMP_DIR, `${videoId}.mp4`);

  // If file already exists, reset its deletion timer
  if (fs.existsSync(outputPath)) {
    if (deleteTimers.has(videoId)) clearTimeout(deleteTimers.get(videoId));
    deleteTimers.set(
      videoId,
      setTimeout(() => {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        deleteTimers.delete(videoId);
      }, 60 * 1000) // 1 minute
    );

    return res.download(outputPath, `${videoId}.mp4`);
  }

  // Download video at 480p (best 480p video + best audio)
  execFile(
    "yt-dlp",
    ["-f", "bestvideo[height<=480]+bestaudio/best[height<=480]", "-o", outputPath, url],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to download video" });
      }

      // Schedule deletion after 1 minute
      deleteTimers.set(
        videoId,
        setTimeout(() => {
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          deleteTimers.delete(videoId);
        }, 60 * 1000)
      );

      res.download(outputPath, `${videoId}.mp4`);
    }
  );
});

app.listen(PORT, () => {
  console.log(`YouTube MP4 API running on port ${PORT}`);
});
