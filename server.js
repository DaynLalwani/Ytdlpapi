const express = require("express");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, "tmp");

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const deleteTimers = new Map();

const SESSION_PATH = path.join(__dirname, "session.json");
const COOKIE_PATH = path.join(TEMP_DIR, "cookies.txt");

// ========================
// Restore session.json from ENV
// ========================
if (!process.env.YOUTUBE_SESSION_BASE64) {
  console.error("❌ YOUTUBE_SESSION_BASE64 env variable not set");
  process.exit(1);
}

try {
  const sessionBuffer = Buffer.from(process.env.YOUTUBE_SESSION_BASE64, "base64");
  fs.writeFileSync(SESSION_PATH, sessionBuffer.toString());
  console.log("✅ session.json restored from ENV");
} catch (err) {
  console.error("Failed to restore session.json:", err);
  process.exit(1);
}

// ========================
// Auto-generate cookies.txt from session.json
// ========================
async function refreshCookies() {
  try {
    const browser = await chromium.launch({ args: ["--no-sandbox"] });
    const context = await browser.newContext({ storageState: SESSION_PATH });
    const page = await context.newPage();
    await page.goto("https://www.youtube.com", { waitUntil: "networkidle" });

    const cookies = await context.cookies();

    let netscape = "# Netscape HTTP Cookie File\n";
    cookies.forEach(c => {
      netscape += `${c.domain}\tTRUE\t${c.path}\t${c.secure}\t${Math.floor(c.expires || 0)}\t${c.name}\t${c.value}\n`;
    });

    fs.writeFileSync(COOKIE_PATH, netscape);
    await browser.close();

    console.log("✅ Cookies refreshed");
  } catch (e) {
    console.error("Cookie refresh failed:", e);
  }
}

// Refresh cookies every 25 minutes
setInterval(refreshCookies, 25 * 60 * 1000);
refreshCookies();

// ========================
// STREAM ENDPOINT
// ========================
app.get("/stream/:id", async (req, res) => {
  const videoId = req.params.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(TEMP_DIR, `${videoId}.mp4`);

  console.log("Serving:", videoId);

  if (!fs.existsSync(COOKIE_PATH)) {
    return res.status(500).send("Cookies not ready yet");
  }

  if (!fs.existsSync(outputPath)) {
    const args = [
      "--cookies", COOKIE_PATH,
      "-f", "bestvideo[height<=480]+bestaudio/best/best",
      "--merge-output-format", "mp4",
      "-o", outputPath,
      url
    ];

    try {
      await new Promise((resolve, reject) => {
        execFile("yt-dlp", args, (err, stdout, stderr) => {
          if (err) {
            console.error(stderr.toString());
            reject(err);
          } else resolve();
        });
      });
    } catch (e) {
      return res.status(500).send("yt-dlp failed");
    }
  }

  if (deleteTimers.has(videoId)) clearTimeout(deleteTimers.get(videoId));
  deleteTimers.set(videoId, setTimeout(() => {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    deleteTimers.delete(videoId);
  }, 5 * 60 * 1000));

  const stat = fs.statSync(outputPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    const stream = fs.createReadStream(outputPath, { start, end });
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Type": "video/mp4"
    });

    stream.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4"
    });
    fs.createReadStream(outputPath).pipe(res);
  }
});

// ========================
app.listen(PORT, () => {
  console.log(`Streaming server running on port ${PORT}`);
});
