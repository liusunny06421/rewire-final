import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chatHandler from "./api/chat.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/chat", (req, res) => chatHandler(req, res));

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
