const express = require("express");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

// Optional: set your cookies if required for age-restricted/private videos
const YOUTUBE_COOKIES = process.env.YOUTUBE_COOKIES || null;

app.get("/stream/:id", (req, res) => {
  const videoId = req.params.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  // Build yt-dlp args to get best mp4 stream and output to stdout
  const args = [
    url,
    "-f", "bestvideo[height<=480]+bestaudio/best/best",
    "--merge-output-format", "mp4",
    "-o", "-",            // output to stdout
  ];

  if (YOUTUBE_COOKIES) {
    args.unshift("--cookies", "-"); // use stdin for cookies
  }

  // Set response headers for video streaming
  res.writeHead(200, {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
  });

  const yt = spawn("yt-dlp", args, YOUTUBE_COOKIES ? { stdio: ["pipe", "pipe", "pipe"] } : undefined);

  // If cookies are required, write them to stdin
  if (YOUTUBE_COOKIES) {
    yt.stdin.write(YOUTUBE_COOKIES.replace(/\\n/g, "\n"));
    yt.stdin.end();
  }

  // Pipe stdout directly to response
  yt.stdout.pipe(res);

  yt.stderr.on("data", (data) => {
    console.error(`yt-dlp stderr: ${data}`);
  });

  yt.on("close", (code) => {
    if (code !== 0) {
      console.error(`yt-dlp exited with code ${code}`);
    }
    res.end();
  });

  // Handle client disconnect
  req.on("close", () => {
    yt.kill("SIGKILL");
  });
});

app.listen(PORT, () => {
  console.log(`Streaming server running on port ${PORT}`);
});
