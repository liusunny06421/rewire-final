import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is missing in Vercel" });
    }

    const { systemPrompt, messages } = req.body;

    if (!systemPrompt || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing systemPrompt or messages" });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const input = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input,
    });

    return res.status(200).json({
      reply: response.output_text || "I'm here — can you say that again?",
    });
  } catch (error) {
    console.error("OpenAI error:", error);

    return res.status(500).json({
      error: error?.message || "Failed to generate response",
    });
  }
}
