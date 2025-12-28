// server.js — FIXED, CLEAN, WORKING (Node 22+, no node-fetch)

import express from "express";

const app = express();

/* ===== CONFIG ===== */

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = "https://sl-spotify-connector.onrender.com/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("FATAL: Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
    process.exit(1);
}

/* ===== STATE STORAGE (in-memory) ===== */

const states = new Map();

/* ===== ROUTES ===== */

// Start Spotify OAuth
app.get("/login", (req, res) => {
    const { state, avatar } = req.query;

    if (!state || !avatar) {
        return res.status(400).send("Missing state or avatar");
    }

    states.set(state, {
        avatar,
        connected: false,
        token: null
    });

    const params = new URLSearchParams({
        response_type: "code",
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: "user-read-playback-state user-read-currently-playing",
        state
    });

    res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

// Spotify OAuth callback
app.get("/callback", async (req, res) => {
    const { code, state } = req.query;

    if (!code || !states.has(state)) {
        return res.status(400).send("Invalid callback");
    }

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

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
        console.error("Spotify token error:", tokenData);
        return res.status(500).send("Spotify token exchange failed");
    }

    const entry = states.get(state);
    entry.connected = true;
    entry.token = tokenData.access_token;
    states.set(state, entry);

    res.send("Spotify connected. You may return to Second Life.");
});

// Status check (polled by LSL)
app.get("/status", (req, res) => {
    const { state } = req.query;

    if (!state || !states.has(state)) {
        return res.json({ connected: false });
    }

    res.json({ connected: states.get(state).connected === true });
});

// Optional health check
app.get("/", (req, res) => {
    res.send("SL Spotify Connector running");
});

/* ===== START SERVER ===== */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server listening on port", PORT);
});
