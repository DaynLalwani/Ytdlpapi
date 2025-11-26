const express = require("express");
const { spawn } = require("child_process");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend requests
app.use(cors());

// Optional: YouTube cookies for private/age-restricted videos
const YOUTUBE_COOKIES = process.env.YOUTUBE_COOKIES || null;

/**
 * Usage:
 * /stream/:id -> best MP4 available
 * /stream/:id?quality=720 -> 720p MP4
 */
app.get("/stream/:id", (req, res) => {
  const videoId = req.params.id;
  const quality = req.query.quality || "best";
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  // Quality -> yt-dlp format selector (progressive MP4 only)
  const qualityFormats = {
    "1080": "best[ext=mp4][height<=1080][acodec!=none][vcodec!=none]",
    "720":  "best[ext=mp4][height<=720][acodec!=none][vcodec!=none]",
    "480":  "best[ext=mp4][height<=480][acodec!=none][vcodec!=none]",
    "360":  "best[ext=mp4][height<=360][acodec!=none][vcodec!=none]",
    "best": "best[ext=mp4][acodec!=none][vcodec!=none]/best"
  };

  const format = qualityFormats[quality] || qualityFormats.best;

  const args = ["-g", "-f", format, url];

  // If cookies are provided, use them
  if (YOUTUBE_COOKIES) {
    args.unshift("--cookies", "-");
  }

  const yt = spawn("yt-dlp", args, YOUTUBE_COOKIES ? { stdio: ["pipe", "pipe", "pipe"] } : undefined);

  if (YOUTUBE_COOKIES) {
    yt.stdin.write(YOUTUBE_COOKIES.replace(/\\n/g, "\n"));
    yt.stdin.end();
  }

  let link = "";

  yt.stdout.on("data", data => link += data.toString());
  yt.stderr.on("data", data => console.error("yt-dlp:", data.toString()));

  yt.on("close", code => {
    if (code !== 0 || !link.trim()) {
      return res.status(500).json({ error: "Failed to get MP4 link" });
    }

    res.json({
      videoId,
      quality,
      stream: link.trim()
    });
  });
});

app.listen(PORT, () => {
  console.log(`✅ MP4 streaming API running at http://localhost:${PORT}`);
});
