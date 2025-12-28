// server.js (INVALID_CLIENT FIX — STRICT SPOTIFY REQUIREMENTS)

import express from "express";
import fetch from "node-fetch";

const app = express();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET?.trim();
const REDIRECT_URI = "https://sl-spotify-connector.onrender.com/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing Spotify CLIENT_ID or CLIENT_SECRET");
}

const states = new Map();

app.get("/login", (req, res) => {
    const { state, avatar } = req.query;
    if (!state || !avatar) return res.status(400).send("Bad request");

    const params = new URLSearchParams({
        response_type: "code",
        client_id: CLIENT_ID,
        scope: "user-read-playback-state user-read-currently-playing",
        redirect_uri: REDIRECT_URI,
        state
    });

    states.set(state, { connected: false });

    res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

app.get("/callback", async (req, res) => {
    const { code, state } = req.query;
    if (!states.has(state)) return res.status(400).send("Invalid state");

    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Authorization":
                "Basic " +
                Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI
        })
    });

    const token = await tokenRes.json();
    if (!token.access_token) return res.status(500).send("Token exchange failed");

    states.get(state).connected = true;
    res.send("Spotify connected. Return to Second Life.");
});

app.get("/status", (req, res) => {
    res.json({ connected: states.get(req.query.state)?.connected === true });
});

const port = process.env.PORT || 3000;
app.listen(port);
