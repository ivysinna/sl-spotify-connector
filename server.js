import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// avatar_uuid → tokens
let users = {};

// ---------- ROOT ----------
app.get("/", (req, res) => {
  res.send("Spotify multi-user connector running.");
});

// ---------- LOGIN ----------
app.get("/login", (req, res) => {
  const user = req.query.user;
  if (!user) {
    res.status(400).send("Missing user parameter");
    return;
  }

  const scope = "user-read-currently-playing user-read-playback-state";

  res.redirect(
    "https://accounts.spotify.com/authorize" +
      "?response_type=code" +
      "&client_id=" + CLIENT_ID +
      "&scope=" + encodeURIComponent(scope) +
      "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
      "&state=" + encodeURIComponent(user)
  );
});

// ---------- CALLBACK ----------
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const user = req.query.state;

  if (!code || !user) {
    res.status(400).send("Missing code or state");
    return;
  }

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization":
        "Basic " +
        Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body:
      "grant_type=authorization_code" +
      "&code=" + code +
      "&redirect_uri=" + encodeURIComponent(REDIRECT_URI)
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    console.error(tokenData);
    res.status(500).send("Token error");
    return;
  }

  users[user] = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token
  };

  res.send("Spotify connected. You can close this window.");
});

// ---------- NOW PLAYING ----------
app.get("/spotify", async (req, res) => {
  const user = req.query.user;
  if (!user || !users[user]) {
    res.status(401).json({ error: "User not connected" });
    return;
  }

  const apiRes = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    {
      headers: {
        Authorization: "Bearer " + users[user].access_token
      }
    }
  );

  if (apiRes.status !== 200) {
    res.status(204).send("");
    return;
  }

  const data = await apiRes.json();
  if (!data || !data.item) {
    res.status(204).send("");
    return;
  }

  res.json({
    track: data.item.name,
    artist: data.item.artists[0].name,
    progress_ms: data.progress_ms,
    duration_ms: data.item.duration_ms
  });
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
