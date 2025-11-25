const express = require("express");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const app = express();

const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, "tmp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

app.get("/download/:id", (req, res) => {
  const videoId = req.params.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(TEMP_DIR, `${videoId}.mp4`);

  execFile(
    "yt-dlp",
    ["-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4", "-o", outputPath, url],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to download video" });
      }
      res.download(outputPath, `${videoId}.mp4`, () => {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      });
    }
  );
});

app.listen(PORT, () => {
  console.log(`YouTube MP4 API running on port ${PORT}`);
});
