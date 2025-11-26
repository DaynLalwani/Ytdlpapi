const express = require("express");
const { spawn } = require("child_process");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const YOUTUBE_COOKIES = process.env.YOUTUBE_COOKIES || null;

app.get("/stream/:id", async (req, res) => {
  const videoId = req.params.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  // Try progressive MP4 first
  const progressiveArgs = [
    "-f", "best[ext=mp4][height<=480]",
    "-g",
    url
  ];
  if (YOUTUBE_COOKIES) progressiveArgs.unshift("--cookies", "-");

  const prog = spawn("yt-dlp", progressiveArgs, YOUTUBE_COOKIES ? { stdio: ["pipe", "pipe", "pipe"] } : undefined);

  if (YOUTUBE_COOKIES) {
    prog.stdin.write(YOUTUBE_COOKIES.replace(/\\n/g, "\n"));
    prog.stdin.end();
  }

  let link = "";
  prog.stdout.on("data", data => link += data.toString());
  prog.stderr.on("data", data => console.error("yt-dlp:", data.toString()));

  prog.on("close", code => {
    if (code === 0 && link.trim()) {
      // Progressive MP4 exists
      return res.json({ videoId, stream: link.trim() });
    }

    // No progressive MP4, download and compress
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ytmp4-"));
    const videoFile = path.join(tmpDir, "video.mp4");

    const mergeArgs = [
      "-f", "bestvideo[height<=480]+bestaudio/best",
      "-o", videoFile,
      url
    ];
    if (YOUTUBE_COOKIES) mergeArgs.unshift("--cookies", "-");

    const dl = spawn("yt-dlp", mergeArgs, YOUTUBE_COOKIES ? { stdio: ["pipe", "inherit", "inherit"] } : undefined);

    if (YOUTUBE_COOKIES) {
      dl.stdin.write(YOUTUBE_COOKIES.replace(/\\n/g, "\n"));
      dl.stdin.end();
    }

    dl.on("close", (code) => {
      if (code !== 0 || !fs.existsSync(videoFile)) {
        return res.status(500).json({ error: "Failed to download and merge video" });
      }

      // Compress with ffmpeg to 480p + MP4 + low bitrate
      const compressedFile = path.join(tmpDir, "compressed.mp4");
      const ffmpegArgs = [
        "-i", videoFile,
        "-vf", "scale=-2:480", // maintain aspect ratio, height=480
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "28",           // high compression
        "-c:a", "aac",
        "-b:a", "128k",
        compressedFile
      ];

      const ff = spawn("ffmpeg", ffmpegArgs, { stdio: ["inherit", "inherit", "inherit"] });
      ff.on("close", () => {
        if (!fs.existsSync(compressedFile)) {
          return res.status(500).json({ error: "Failed to compress video" });
        }

        // Serve file as URL
        res.download(compressedFile, `${videoId}.mp4`, (err) => {
          // Cleanup temp files
          fs.rmSync(tmpDir, { recursive: true, force: true });
        });
      });
    });
  });
});

app.listen(PORT, () => console.log(`✅ API running on http://localhost:${PORT}`));
