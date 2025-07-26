import { getStore } from '@netlify/blobs';
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async (request) => {
  let jobId;
  try {
    const body = await request.json();
    jobId = body.jobId;
    const { lorebookName, combinedData } = body;

    const resultsStore = getStore({ name: "json-results" });
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
        You are an expert at parsing unstructured text and converting it into a structured JSON format for a lorebook.
        Analyze the provided "Lore Data" and create a complete JSON object that strictly follows this schema:

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
        1.  The root "name" of the JSON object must be exactly: "${lorebookName}"
        2.  The root "thumbnail" must be an empty string: "".
        3.  Read through the "Lore Data" and identify all distinct entities (the options for type are: characters, locations, events, objects, plots). If the Lore Data itself contains JSON, intelligently merge its entries with new entries derived from any surrounding plain text.  Rember the 1600 character limit for descriptions.
        4.  For each entity you identify, create one entry object in the "entries" array.
        5.  For each entry object:
            - "name": The proper name of the entity.
            - "description": A concise but detailed summary of the entity based on the provided text.  1600 character limit.
            - "type": Classify the entity into one of the valid types.
            - "keys": Generate an array of relevant keywords as objects, like this: {"keyText": "your keyword"}.
        6.  Your final output must be ONLY the valid JSON object. Do not include any explanatory text, markdown formatting (like \`\`\`json), or anything else outside of the JSON itself.

        ### Lore Data ###
        ---
        ${combinedData}
        ---
        `;

    const result = await model.generateContent(prompt);
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

export const config = {
  path: "/.netlify/functions/generate-background"
};