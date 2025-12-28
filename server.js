import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

/*
  In-memory token store
  avatarUUID -> { access_token, refresh_token }
*/
let users = {};

/* ---------- ROOT ---------- */
app.get("/", (req, res) => {
  res.send("Second Life Spotify Connector running.");
});

/* ---------- LOGIN ---------- */
app.get("/login", (req, res) => {
  const user = req.query.user;
  if (!user) {
    res.status(400).send("Missing user parameter");
    return;
  }

  const scope =
    "user-read-playback-state user-read-currently-playing";

  const authURL =
    "https://accounts.spotify.com/authorize" +
    "?response_type=code" +
    "&client_id=" + CLIENT_ID +
    "&scope=" + encodeURIComponent(scope) +
    "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
    "&state=" + encodeURIComponent(user);

  res.redirect(authURL);
});

/* ---------- CALLBACK ---------- */
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const user = req.query.state;

  if (!code || !user) {
    res.status(400).send("Missing callback data");
    return;
  }

  try {
    const tokenRes = await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              CLIENT_ID + ":" + CLIENT_SECRET
            ).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body:
          "grant_type=authorization_code" +
          "&code=" + code +
          "&redirect_uri=" +
          encodeURIComponent(REDIRECT_URI)
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Token error:", tokenData);
      res.status(500).send("Failed to get access token");
      return;
    }

    users[user] = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token
    };

    res.send(
      "Spotify connected successfully. " +
      "Open Spotify and press Play once."
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error during callback");
  }
});

/* ---------- NOW PLAYING ---------- */
app.get("/spotify", async (req, res) => {
  const user = req.query.user;

  if (!user || !users[user]) {
    res.status(401).send("");
    return;
  }

  try {
    const apiRes = await fetch(
      "https://api.spotify.com/v1/me/player",
      {
        headers: {
          Authorization:
            "Bearer " + users[user].access_token
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
      progress_ms: data.progress_ms || 0,
      duration_ms: data.item.duration_ms || 0,
      is_playing: data.is_playing
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("");
  }
});

/* ---------- DEVICE INFO (NEW) ---------- */
app.get("/device", async (req, res) => {
  const user = req.query.user;
  if (!user || !users[user]) {
    res.status(401).send("");
    return;
  }

  try {
    const apiRes = await fetch(
      "https://api.spotify.com/v1/me/player/devices",
      {
        headers: {
          Authorization:
            "Bearer " + users[user].access_token
        }
      }
    );

    const data = await apiRes.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send("");
  }
});

/* ---------- START SERVER ---------- */
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
