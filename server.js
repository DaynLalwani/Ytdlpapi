const express = require("express");
const { spawn } = require("child_process");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const YOUTUBE_COOKIES = process.env.YOUTUBE_COOKIES || null;

app.get("/stream/:id", (req, res) => {
  const videoId = req.params.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  // Only progressive MP4 up to 480p
  const args = ["-g", "-f", "best[ext=mp4][height<=480]"];

  if (YOUTUBE_COOKIES) {
    args.unshift("--cookies", "-");
  }

  args.push(url);

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
    res.json({ videoId, stream: link.trim() });
  });
});

app.listen(PORT, () => console.log(`✅ API running on http://localhost:${PORT}`));
