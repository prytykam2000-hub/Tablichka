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

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const textResponse = await response.text();
      console.error("Non-JSON response received:", textResponse);
      throw new Error("Сервер повернув помилку (не JSON). Можливо, API ключ не налаштовано або сервер перевантажений.");
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Помилка сервера: ${response.status}`);
    }

    return await response.json() as LabResults;
  } catch (error: any) {
    console.error("API extraction error:", error);
    throw error;
  }
};