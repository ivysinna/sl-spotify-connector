// server.js — GUARANTEED FIX

import express from "express";
import fetch from "node-fetch";

const app = express();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = "https://sl-spotify-connector.onrender.com/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("FATAL: Missing Spotify credentials");
    process.exit(1);
}

const states = new Map();

app.get("/login", (req, res) => {
    const { state, avatar } = req.query;

    if (!state || !avatar) {
        return res.status(400).send("Missing state or avatar");
    }

    states.set(state, { connected: false });

    const params = new URLSearchParams({
        response_type: "code",
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: "user-read-playback-state user-read-currently-playing",
        state
    });

    const url = "https://accounts.spotify.com/authorize?" + params.toString();

    res.redirect(url);
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
