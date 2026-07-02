import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Schema } from "@google/genai";

// We'll import these types and constants
// Since we are in a bundled environment or using tsx, we can import them directly
import { LAB_PARAMETERS } from "./constants";
import { LabResults } from "./types";

const app = express();
const PORT = 3000;

// Health check route BEFORE everything else
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

app.use(express.json({ limit: '50mb' }));

// Gemini Setup
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Construct the schema dynamically
const properties: Record<string, Schema> = {};
LAB_PARAMETERS.forEach((param) => {
  properties[param.id] = {
    type: Type.STRING,
    description: `Value for ${param.label}. Extract ONLY the number. Normalize decimals to use dots (e.g. 5.5). If not found, return null.`,
    nullable: true,
  };
});

const extractionSchema: Schema = {
  type: Type.OBJECT,
  properties: properties,
  required: [],
};

app.post("/api/extract", async (req, res) => {
  console.log("Extraction request received");
  try {
    const { text, imagesData } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      console.error("Missing GEMINI_API_KEY");
      return res.status(500).json({ error: "Gemini API key is not configured on the server. Please check the Secrets panel in Settings." });
    }

    const mappingInstructions = LAB_PARAMETERS.map(p => {
       const match = p.label.match(/^(.+)\s*\((.+)\)$/);
       if (match) {
         return `- "${p.label}" OR "${match[1].trim()}" OR "${match[2].trim()}" -> maps to key "${p.id}"`;
       }
       return `- "${p.label}" -> maps to key "${p.id}"`;
    }).join("\n");

    const hasImages = imagesData && imagesData.length > 0;

    const prompt = `You are an expert medical data extractor specialized in parsing Ukrainian laboratory test results from text or images.

${hasImages ? "Analyze the provided image(s) of medical reports." : "Analyze the unstructured text provided below."}

### Extraction Rules:
1. **Target Parameters**: Extract values ONLY for the parameters listed in the mapping below.
2. **Value Format**: Return values as strings. Replace commas with dots (e.g., "5,5" -> "5.5"). Remove any units (like g/L, %, etc.).
3. **Missing Data**: If a parameter is not mentioned or not visible, set its value to null.
4. **Language**: The input is in Ukrainian. Be flexible with abbreviations.
5. **Ignore Parentheses**: If a parameter name is followed by an abbreviation in parentheses (e.g. "Лейкоцити (WBC) 5.5"), the number following the parentheses belongs to the parameter name before them.

### Parameter Mapping (Label/Synonyms -> Key):
${mappingInstructions}

Return the result strictly as a JSON object matching the schema.`;

    const parts: any[] = [{ text: prompt }];
    
    if (text && text.trim()) {
      parts.push({ text: `### Input Text:\n"""\n${text}\n"""` });
    }

    if (hasImages) {
      console.log(`Processing ${imagesData.length} images`);
      imagesData.forEach((img: any) => {
        parts.push({
          inlineData: {
            data: img.data,
            mimeType: img.mimeType
          }
        });
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: extractionSchema,
        temperature: 0,
      },
    });

    const resultText = response.text;
    console.log("Extraction successful");
    if (!resultText) {
      return res.json({});
    }

    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Gemini extraction error:", error);
    res.status(500).json({ error: error.message || "Failed to extract data" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
