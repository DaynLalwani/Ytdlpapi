const express = require("express");
const { spawn } = require("child_process");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Optional cookies for private/age-restricted videos
const YOUTUBE_COOKIES = process.env.YOUTUBE_COOKIES || null;

app.get("/stream/:id", (req, res) => {
  const videoId = req.params.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  // Force yt-dlp to find the best progressive MP4 (video + audio combined)
  const args = [
    url,
    "-g", // get direct link only
    "-f",
    "best[ext=mp4][acodec!=none][vcodec!=none]/best[ext=mp4]"
  ];

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
      stream: link.trim()
    });
  });
});

app.listen(PORT, () => {
  console.log(`✅ Best MP4 API running at http://localhost:${PORT}`);
});
