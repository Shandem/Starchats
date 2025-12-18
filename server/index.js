import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

function basicAuthHeader(appId, appSecret) {
  const token = Buffer.from(`${appId}:${appSecret}`).toString("base64");
  return `Basic ${token}`;
}

app.post("/api/star-chart", async (req, res) => {
  try {
    const { ASTRONOMY_APP_ID, ASTRONOMY_APP_SECRET } = process.env;

    if (!ASTRONOMY_APP_ID || !ASTRONOMY_APP_SECRET) {
      return res
        .status(500)
        .json({ error: "Missing AstronomyAPI credentials in .env" });
    }

    const r = await fetch(
      "https://api.astronomyapi.com/api/v2/studio/star-chart",
      {
        method: "POST",
        headers: {
          Authorization: basicAuthHeader(
            ASTRONOMY_APP_ID,
            ASTRONOMY_APP_SECRET
          ),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      }
    );

    const text = await r.text();
    res.status(r.status).send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error calling AstronomyAPI" });
  }
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`API proxy: http://localhost:${PORT}`));
