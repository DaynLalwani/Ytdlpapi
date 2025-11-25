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

app.get("/download/:id", (req, res) => {
  const videoId = req.params.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(TEMP_DIR, `${videoId}.mp4`);
  const cookieFilePath = path.join(TEMP_DIR, `cookies_${videoId}.txt`);

  // Write cookies from ENV variable
  if (process.env.YOUTUBE_COOKIES) {
    fs.writeFileSync(
      cookieFilePath,
      process.env.YOUTUBE_COOKIES.replace(/\\n/g, "\n")
    );
  }

  // If file already exists, reset deletion timer and send it
  if (fs.existsSync(outputPath)) {
    if (deleteTimers.has(videoId)) clearTimeout(deleteTimers.get(videoId));
    deleteTimers.set(
      videoId,
      setTimeout(() => {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        if (fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);
        deleteTimers.delete(videoId);
      }, 60 * 1000) // 1 minute
    );

    return res.download(outputPath, `${videoId}.mp4`);
  }

  // Download video at 480p (fallback if not available)
  const args = [
    "-f",
    "bestvideo[height<=480]+bestaudio/best",
    "--merge-output-format",
    "mp4",
    "-o",
    outputPath,
    url,
  ];

  // Add cookies if available
  if (process.env.YOUTUBE_COOKIES) args.unshift("--cookies", cookieFilePath);

  execFile("yt-dlp", args, (err, stdout, stderr) => {
    if (err) {
      console.error("yt-dlp error:", stderr.toString());
      if (fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);
      return res.status(500).json({
        error: "Failed to download video",
        details: stderr.toString(),
      });
    }

    // Schedule deletion of file and cookie after 1 minute
    deleteTimers.set(
      videoId,
      setTimeout(() => {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        if (fs.existsSync(cookieFilePath)) fs.unlinkSync(cookieFilePath);
        deleteTimers.delete(videoId);
      }, 60 * 1000)
    );

    // Send file to client (IE11 compatible)
    res.download(outputPath, `${videoId}.mp4`);
  });
});

app.listen(PORT, () => {
  console.log(`YouTube MP4 API running on port ${PORT}`);
});
