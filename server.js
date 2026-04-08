import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chatHandler from "./api/chat.js";
import visionHandler from "./api/vision.js";
import ttsHandler from "./api/tts.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.post("/api/chat", (req, res) => chatHandler(req, res));
app.post("/api/vision", (req, res) => visionHandler(req, res));
app.post("/api/tts", (req, res) => ttsHandler(req, res));

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
