import OpenAI from "openai";

const NUTRITION_PROMPT = `You are a nutrition analysis system. You will be shown a photo of a meal. Identify the foods and estimate nutrition based on visible portion sizes.

Return ONLY valid JSON matching this exact schema (no markdown, no commentary):
{
  "items": ["string", ...],
  "calories": number,
  "macros": {
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number
  },
  "micros": {
    "omega3": "low" | "moderate" | "high",
    "b_vitamins": "low" | "moderate" | "high",
    "iron": "low" | "moderate" | "high",
    "magnesium": "low" | "moderate" | "high",
    "choline": "low" | "moderate" | "high",
    "zinc": "low" | "moderate" | "high"
  },
  "brain_score": number,
  "brain_notes": "string",
  "confidence": "low" | "medium" | "high"
}

brain_score is 0–10 and reflects how supportive this meal is for an ADHD brain (protein, omega-3, B vitamins, stable blood sugar, minimal added sugar).
brain_notes is one short sentence (max 25 words) explaining the brain score.
If the image is not a meal, return {"error": "not_a_meal"}.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is missing" });
    }

    const { imageBase64, note } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64" });
    }

    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const userText = note
      ? `User note about this meal: ${note}\n\nAnalyze this meal photo and return strict JSON.`
      : "Analyze this meal photo and return strict JSON.";

    const response = await client.responses.create({
      model:
        process.env.OPENAI_VISION_MODEL ||
        process.env.OPENAI_MODEL ||
        "gpt-4.1-mini",
      input: [
        { role: "system", content: NUTRITION_PROMPT },
        {
          role: "user",
          content: [
            { type: "input_text", text: userText },
            { type: "input_image", image_url: dataUrl },
          ],
        },
      ],
    });

    const raw = response.output_text || "";
    const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();

    let nutrition;
    try {
      nutrition = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        return res.status(502).json({ error: "Model did not return JSON", raw });
      }
      nutrition = JSON.parse(match[0]);
    }

    if (nutrition?.error === "not_a_meal") {
      return res.status(422).json({ error: "That doesn't look like a meal photo." });
    }

    return res.status(200).json({ nutrition });
  } catch (error) {
    console.error("Vision error:", error);
    return res.status(500).json({
      error: error?.message || "Failed to analyze image",
    });
  }
}
