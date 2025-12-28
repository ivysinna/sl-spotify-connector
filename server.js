import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

let users = {};

/* ---------- ROOT ---------- */
app.get("/", (req, res) => {
  res.send("Second Life Spotify Connector running");
});

/* ---------- LOGIN ---------- */
app.get("/login", (req, res) => {
  const user = req.query.user;
  if (!user) return res.status(400).send("Missing user");

  const scope = "user-read-playback-state user-read-currently-playing";

  res.redirect(
    "https://accounts.spotify.com/authorize" +
      "?response_type=code" +
      "&client_id=" + CLIENT_ID +
      "&scope=" + encodeURIComponent(scope) +
      "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
      "&state=" + encodeURIComponent(user)
  );
});

/* ---------- CALLBACK ---------- */
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const user = req.query.state;

  if (!code || !user) {
    return res.status(400).send("Missing callback data");
  }

  const tokenRes = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body:
        "grant_type=authorization_code" +
        "&code=" + code +
        "&redirect_uri=" + encodeURIComponent(REDIRECT_URI)
    }
  );

  const data = await tokenRes.json();

  if (!data.access_token) {
    console.error(data);
    return res.status(500).send("Token error");
  }

  users[user] = {
    access_token: data.access_token,
    refresh_token: data.refresh_token
  };

  res.send(
    "Spotify connected. Open Spotify and press Play once."
  );
});

/* ---------- NOW PLAYING (FIXED) ---------- */
app.get("/spotify", async (req, res) => {
  const user = req.query.user;
  if (!user || !users[user]) {
    return res.status(401).send("");
  }

  const apiRes = await fetch(
    "https://api.spotify.com/v1/me/player",
    {
      headers: {
        Authorization: "Bearer " + users[user].access_token
      }
    }
  );

  if (apiRes.status !== 200) {
    return res.status(204).send("");
  }

  const data = await apiRes.json();
  if (!data || !data.item) {
    return res.status(204).send("");
  }

  res.json({
    track: data.item.name,
    artist: data.item.artists[0].name,
    progress_ms: data.progress_ms || 0,
    duration_ms: data.item.duration_ms || 0,
    is_playing: data.is_playing
  });
});

/* ---------- START ---------- */
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
