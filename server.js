// server.js
import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = "https://sl-spotify-connector.onrender.com/callback";

const states = new Map();

app.get("/login", (req, res) => {
    const { state, avatar } = req.query;

    states.set(state, {
        avatar,
        connected: false,
        token: null
    });

    const scope = "user-read-playback-state user-read-currently-playing";
    const authURL =
        "https://accounts.spotify.com/authorize?" +
        new URLSearchParams({
            response_type: "code",
            client_id: CLIENT_ID,
            scope,
            redirect_uri: REDIRECT_URI,
            state
        });

    res.redirect(authURL);
});

app.get("/callback", async (req, res) => {
    const { code, state } = req.query;
    if (!states.has(state)) return res.status(400).send("Invalid state");

    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization:
                "Basic " +
                Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64")
        },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI
        })
    });

    const tokenData = await tokenRes.json();

    const entry = states.get(state);
    entry.connected = true;
    entry.token = tokenData.access_token;
    states.set(state, entry);

    res.send("Spotify connected. You may now return to Second Life.");
});

app.get("/status", (req, res) => {
    const { state } = req.query;
    if (!states.has(state)) return res.json({ connected: false });

    const entry = states.get(state);
    res.json({ connected: entry.connected });
});

const port = process.env.PORT || 3000;
app.listen(port);
