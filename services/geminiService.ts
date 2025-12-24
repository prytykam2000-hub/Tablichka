import { GoogleGenAI, Type, Schema } from "@google/genai";
import { LAB_PARAMETERS } from "../constants";
import { LabResults } from "../types";

// Construct the schema dynamically based on constants to ensure sync
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

export const extractLabData = async (text: string, imagesData?: { data: string, mimeType: string }[]): Promise<LabResults> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  
  if (text.trim()) {
    parts.push({ text: `### Input Text:\n"""\n${text}\n"""` });
  }

  if (hasImages) {
    imagesData.forEach(img => {
      parts.push({
        inlineData: {
          data: img.data,
          mimeType: img.mimeType
        }
      });
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: extractionSchema,
        temperature: 0,
      },
    });

    const jsonText = response.text;
    if (!jsonText) return {};
    
    return JSON.parse(jsonText) as LabResults;
  } catch (error) {
    console.error("Gemini extraction error:", error);
    throw error;
  }
};
