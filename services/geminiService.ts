import { LabResults } from "../types";

export const extractLabData = async (text: string, imagesData?: { data: string, mimeType: string }[]): Promise<LabResults> => {
  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, imagesData }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    return await response.json() as LabResults;
  } catch (error: any) {
    console.error("API extraction error:", error);
    throw error;
  }
};