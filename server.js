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
  In-memory storage:
  userUUID -> { access_token, refresh_token }
*/
let users = {};

/* ---------- ROOT ---------- */
app.get("/", (req, res) => {
  res.send("Second Life Spotify Connector is running.");
});

/* ---------- LOGIN ---------- */
app.get("/login", (req, res) => {
  const user = req.query.user;
  if (!user) {
    res.status(400).send("Missing user parameter");
    return;
  }

  const scope =
    "user-read-currently-playing user-read-playback-state";

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
    res.status(400).send("Missing code or user state");
    return;
  }

  try {
    const tokenRes = await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          "Authorization":
            "Basic " +
            Buffer.from(
              CLIENT_ID + ":" + CLIENT_SECRET
            ).toString("base64"),
          "Content-Type":
            "application/x-www-form-urlencoded"
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
      "Return to Second Life and press Play in Spotify."
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
    res.status(401).json({ error: "User not connected" });
    return;
  }

  try {
    const apiRes = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: {
          "Authorization":
            "Bearer " + users[user].access_token
        }
      }
    );

    // Spotify returns 204 when nothing is playing
    if (apiRes.status === 204) {
      res.status(204).send("");
      return;
    }

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
  } catch (err) {
    console.error(err);
    res.status(500).send("Spotify API error");
  }
});

/* ---------- START SERVER ---------- */
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
