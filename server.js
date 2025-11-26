app.get("/stream/:id", async (req, res) => {
  const { id } = req.params;
  const url = `https://www.youtube.com/watch?v=${id}`;

  const args = [
    "-f", "best[ext=mp4][height<=480]", // only progressive MP4
    "-g", // get direct URL
    url
  ];

  if (YOUTUBE_COOKIES) args.unshift("--cookies", "-");

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
      return res.status(500).json({ 
        error: "No progressive MP4 available. Cannot provide a direct MP4 link without downloading." 
      });
    }
    res.json({ videoId: id, stream: link.trim() });
  });
});
