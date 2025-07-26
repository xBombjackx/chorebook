const { GoogleGenerativeAI } = require("@google/generative-ai");

// Get the secret API key from Netlify's environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.handler = async function (event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        // Get the raw data from your index.html
        const { lorebookName, combinedData } = JSON.parse(event.body);

        // --- This is the detailed prompt from your HTML ---
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
        3.  Read through the "Lore Data" and identify all distinct entities (characters, locations, events, important objects, plot points, etc.).
        4.  For each entity you identify, create one entry object in the "entries" array.
        5.  For each entry object:
            - "name": The proper name of the entity (e.g., "Aragorn", "The Shire", "The One Ring").
            - "description": A concise but detailed summary of the entity based on the provided text.  1600 character limit.
            - "type": Classify the entity into one of the valid types: "character", "location", "event", "plot", "object", or "other".
            - "keys": Generate an array of relevant keywords. Crucially, each keyword must be an object with a single key, "keyText", like this: \`{"keyText": "your keyword"}\`. The "keys" array must be a list of these objects.
        6.  Your final output must be ONLY the valid JSON object. Do not include any explanatory text, markdown formatting, or anything else outside of the JSON itself.

        ### Lore Data ###
        ---
        ${combinedData}
        ---
    `;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const jsonText = response.text();

        return {
            statusCode: 200,
            body: JSON.stringify({ reply: jsonText }),
        };

    } catch (error) {
        console.error("Error in Netlify function:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};