import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialization for GoogleGenAI
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("GEMINI_API_KEY is missing or unconfigured.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: "PhysIQ" });
});

// AI Coach endpoint
app.post("/api/ai/coach", async (req, res) => {
  try {
    const { prompt, context } = req.body;
    const ai = getGenAI();

    if (!ai) {
      // Fallback response if API key is not yet set
      return res.json({
        advice: `Based on your recent activity (${context?.lastWorkout || "Upper Body Push"}) and current recovery score (${context?.recoveryScore || 84}%), here is your AI recommendation: Focus on high-protein synthesis (30g protein within 45 mins) and prioritize 8 hours of sleep. Your chest and shoulders will reach 100% readiness in approximately 18 hours.`,
        suggestedActions: [
          "Consume 35g Protein Shake + 5g Creatine",
          "Perform 10 min light mobility & foam rolling",
          "Drink 750ml water with electrolytes",
          "Aim for 8.5h sleep tonight (Optimal HRV window: 10 PM)"
        ],
        adaptiveProgram: context?.programName ? `Adjusted ${context.programName}: -10% volume on shoulder presses to accommodate current fatigue score.` : "Upper Body Hypertrophy (Deload Shoulder press)"
      });
    }

    const systemInstruction = `You are PhysIQ's Master AI Coach, an elite sports scientist, master nutritionist, and biometric intelligence coach inspired by Apple Health and VisionOS intelligence.
Provide concise, highly actionable, scientific, and motivating advice. Never present predictions as medical facts; present them as AI-powered performance estimates.
Return a structured JSON response with fields:
- advice: string (2-3 crisp sentences summarizing state & action)
- suggestedActions: string[] (3-4 concise, high-impact bullet items)
- adaptiveProgram: string (specific workout adjustment recommendation)
- recoveryEstimate: string (estimated time to full 100% readiness)`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `User Query/Context: ${prompt || "Analyze my current recovery and give me today's optimal plan."}
Context Data: ${JSON.stringify(context || {})}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.error("AI Coach Error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate AI advice." });
  }
});

// AI Nutrition Impact / Recovery Simulator
app.post("/api/ai/nutrition-impact", async (req, res) => {
  try {
    const { meal, currentMuscles } = req.body;
    const ai = getGenAI();

    if (!ai) {
      // Realistic fallback estimate based on meal macros
      const protein = meal?.protein || 45;
      const boost = Math.min(12, Math.round(protein * 0.2));
      return res.json({
        summary: `Logging ${meal?.name || "High Protein Meal"} provides optimal amino acid availability for myofibrillar protein synthesis.`,
        overallRecoveryDelta: `+${boost}%`,
        proteinSupport: "High",
        hydrationSupport: meal?.water ? "Optimal" : "Moderate",
        estimatedTimeImprovement: `-${Math.round(boost * 0.8)} hours`,
        muscleDeltas: [
          { muscleId: "chest", delta: `+${boost}%`, newScore: Math.min(100, (currentMuscles?.chest || 68) + boost) },
          { muscleId: "shoulders", delta: `+${Math.round(boost * 0.7)}%`, newScore: Math.min(100, (currentMuscles?.shoulders || 63) + Math.round(boost * 0.7)) },
          { muscleId: "triceps", delta: `+${boost}%`, newScore: Math.min(100, (currentMuscles?.triceps || 72) + boost) },
          { muscleId: "back", delta: `+${Math.round(boost * 0.6)}%`, newScore: Math.min(100, (currentMuscles?.back || 66) + Math.round(boost * 0.6)) },
        ],
        scientificRationale: "Leucine and essential amino acids trigger mTOR pathway activation, reducing muscle protein breakdown and accelerating cellular repair."
      });
    }

    const systemInstruction = `You are PhysIQ's Nutrition Intelligence & Recovery Simulator Engine.
Calculate how logged or simulated food impacts muscle recovery, glycogen replenishment, inflammation, and fatigue score.
Return JSON with fields:
- summary: string
- overallRecoveryDelta: string (e.g. "+8%")
- proteinSupport: string ("Optimal", "High", "Moderate", or "Low")
- hydrationSupport: string
- estimatedTimeImprovement: string (e.g. "-2.5 hours")
- muscleDeltas: array of objects { muscleId: string, delta: string, newScore: number }
- scientificRationale: string`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Analyze meal impact: ${JSON.stringify(meal)} on current muscle state: ${JSON.stringify(currentMuscles)}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.error("Nutrition Impact Error:", error);
    return res.status(500).json({ error: error.message || "Failed to simulate meal recovery." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PhysIQ] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
