const express = require("express");
const ytdlp = require("yt-dlp-exec");
const path = require("path");
const fs = require("fs");
const app = express();

const PORT = process.env.PORT || 3000;

// Temporary folder to store downloads
const TEMP_DIR = path.join(__dirname, "tmp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// GET /download/:id
app.get("/download/:id", async (req, res) => {
  const videoId = req.params.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(TEMP_DIR, `${videoId}.mp4`);

  try {
    // Download video as MP4
    await ytdlp(url, {
      format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4",
      output: outputPath,
      mergeOutputFormat: "mp4"
    });

    // Serve the file
    res.download(outputPath, `${videoId}.mp4`, err => {
      if (!err && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to download video" });
  }
});

app.listen(PORT, () => {
  console.log(`YouTube MP4 API running on port ${PORT}`);
});
