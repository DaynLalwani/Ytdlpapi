const express = require("express");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

// Optional cookies (for private / age-restricted videos)
const YOUTUBE_COOKIES = process.env.YOUTUBE_COOKIES || null;

/*
 Usage:
 /stream/VIDEO_ID
 /stream/VIDEO_ID?quality=720
*/

app.get("/stream/:id", (req, res) => {
  const videoId = req.params.id;
  const quality = req.query.quality || "best";
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  // Quality mapping (forces progressive MP4 with audio + video)
  const qualityFormatMap = {
    "1080": "best[ext=mp4][height<=1080][acodec!=none][vcodec!=none]",
    "720":  "best[ext=mp4][height<=720][acodec!=none][vcodec!=none]",
    "480":  "best[ext=mp4][height<=480][acodec!=none][vcodec!=none]",
    "360":  "best[ext=mp4][height<=360][acodec!=none][vcodec!=none]",
    "best": "best[ext=mp4][acodec!=none][vcodec!=none]/best"
  };

  const format = qualityFormatMap[quality] || qualityFormatMap["best"];

  const args = [
    url,
    "-g",
    "-f",
    format
  ];

  if (YOUTUBE_COOKIES) {
    args.unshift("--cookies", "-");
  }

  const yt = spawn("yt-dlp", args, YOUTUBE_COOKIES ? { stdio: ["pipe", "pipe", "pipe"] } : undefined);

  let output = "";

  if (YOUTUBE_COOKIES) {
    yt.stdin.write(YOUTUBE_COOKIES.replace(/\\n/g, "\n"));
    yt.stdin.end();
  }

  yt.stdout.on("data", data => {
    output += data.toString();
  });

  yt.stderr.on("data", data => {
    console.error("yt-dlp:", data.toString());
  });

  yt.on("close", code => {
    const link = output.trim();

    if (code !== 0 || !link) {
      return res.status(500).json({
        error: "Failed to generate stream link"
      });
    }

    res.json({
      videoId,
      quality,
      stream: link
    });
  });
});

app.listen(PORT, () => {
  console.log(`✅ Streaming API running on http://localhost:${PORT}`);
});
