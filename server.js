const express = require("express");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const app = express();
const TMP_DIR = path.join(__dirname, "tmp");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

app.get("/video/:id", (req, res) => {
  const videoId = req.params.id;
  const tmpFile = path.join(TMP_DIR, `${videoId}.mp4`);

  // If file exists, stream it
  if (fs.existsSync(tmpFile)) {
    return streamFile(tmpFile, res);
  }

  try {
    // Get a direct MP4 URL (480p if possible)
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    let directLink = execSync(
      `yt-dlp -f "best[ext=mp4][height<=480]" -g "${url}"`
    ).toString().trim();

    if (!directLink) throw new Error("No single mp4 format available");

    // Download & make streamable (-movflags +faststart)
    execSync(
      `yt-dlp -f "best[ext=mp4][height<=480]" -o "${tmpFile}" "${url}"`
    );
    execSync(`ffmpeg -i "${tmpFile}" -c copy -movflags +faststart "${tmpFile}.tmp"`);
    fs.renameSync(`${tmpFile}.tmp`, tmpFile);

    streamFile(tmpFile, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch video", details: err.message });
  }
});

function streamFile(filePath, res) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = res.req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4",
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

// Optional: auto-delete after 1 min
setInterval(() => {
  const files = fs.readdirSync(TMP_DIR);
  const now = Date.now();
  files.forEach(f => {
    const fp = path.join(TMP_DIR, f);
    if (now - fs.statSync(fp).mtimeMs > 60_000) fs.unlinkSync(fp);
  });
}, 30_000);

app.listen(8080, () => console.log("Server running on port 8080"));
