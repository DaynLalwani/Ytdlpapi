const express = require("express");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/stream/:id", (req, res) => {
  const videoId = req.params.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  const args = [
    url,
    "-g",
    "-f",
    "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]"
  ];

  const yt = spawn("yt-dlp", args);

  let streamUrl = "";

  yt.stdout.on("data", data => {
    streamUrl += data.toString();
  });

  yt.on("close", code => {
    if (code !== 0 || !streamUrl.trim()) {
      return res.status(500).json({ error: "Failed to fetch stream link" });
    }

    res.json({
      quality: "Up to 1080p",
      stream: streamUrl.trim()
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
