import { getStore } from '@netlify/blobs';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Helper function to convert Data URL to a format Google's API understands
function fileToGenerativePart(dataUrl, mimeType) {
  return {
    inlineData: {
      data: dataUrl.split(',')[1], // Remove the "data:mime/type;base64," prefix
      mimeType
    },
  };
}

export default async (request) => {
  let jobId;
  try {
    const body = await request.json();
    jobId = body.jobId;
    const { lorebookName, additionalText, files } = body;

    const resultsStore = getStore({ name: "json-results" });
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
        You are an expert at parsing unstructured text and multiple documents (including PDFs, text files, and JSON) to create a single, unified, structured JSON format for a lorebook.
        Analyze the provided files and any additional text, then create a complete JSON object that strictly follows this schema:

        ### JSON Schema ###
        {
          "name": "LOREBOOK_TITLE",
          "thumbnail": "",
          "entries": [
            {
              "name": "Entry Name",
              "description": "Detailed description of the entry.",
              "type": "character | location | event | plot | object | other",
              "keys": [
                {"keyText": "keyword1"},
                {"keyText": "keyword2"}
              ]
            }
          ]
        }
        ### End of Schema ###

        ### Instructions ###
        1. The root "name" of the JSON object must be exactly: "${lorebookName}"
        2. The root "thumbnail" must be an empty string.
        3. Read through all provided files and text. If a file is a JSON lorebook, treat its entries as existing data to be merged or updated with new information. For all other files (PDFs, text, etc.), extract distinct entities and create new entries.
        4. For each entity you identify, create one entry object in the "entries" array.
        5. For each entry object:
            - "name": The proper name of the entity.          
            - "description": A comprehensive and detailed summary of the entity. Extract all relevant information, context, and relationships from the source text to be as descriptive as possible, while strictly adhering to the 1600 character limit.
            - "type": Classify the entity into one of the valid types: "character", "location", "event", "plot", "object", or "other".
            - "keys": Generate an array of relevant keywords as objects, like this: {"keyText": "your keyword"}.
        6. Your final output must be ONLY the valid JSON object. Do not include markdown formatting like \`\`\`json or any other explanatory text.
        7. If there are additional instructions in the text prompt below, prioritize them.
        ---
        Additional Instructions: "${additionalText || 'None'}"
        ---

        Analyze the following files:
        `;

    const fileParts = files.map(file => fileToGenerativePart(file.dataUrl, file.type));

    const result = await model.generateContent([prompt, ...fileParts]);
    const response = result.response;
    let jsonText = response.text();

    jsonText = jsonText.replace(/^```json\s*/, '').replace(/```$/, '');

    await resultsStore.set(jobId, jsonText);

  } catch (error) {
    console.error("Error in background function:", error);
    if (jobId) {
      const store = getStore({ name: "json-results" });
      await store.setJSON(jobId, { status: 'failed', error: error.message });
    }
  }
};