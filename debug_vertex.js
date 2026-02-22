const { VertexAI } = require('@google-cloud/vertexai');
require('dotenv').config();

async function debug() {
    console.log("Project:", process.env.GOOGLE_CLOUD_PROJECT);
    console.log("Location:", process.env.GOOGLE_CLOUD_LOCATION);

    const vertex_ai = new VertexAI({
        project: process.env.GOOGLE_CLOUD_PROJECT,
        location: process.env.GOOGLE_CLOUD_LOCATION
    });

    try {
        console.log("--- Attempting getGenerativeModel ---");
        const model = vertex_ai.getGenerativeModel({ model: 'text-embedding-004' });
        console.log("Model object keys:", Object.keys(model));
        console.log("Model prototype keys:", Object.getOwnPropertyNames(Object.getPrototypeOf(model)));

        if (typeof model.embedContent === 'function') {
            console.log("✅ model.embedContent exists");
        } else {
            console.error("❌ model.embedContent does NOT exist");
        }

    } catch (e) {
        console.error("Error in getGenerativeModel:", e);
    }

    try {
        console.log("--- Attempting getGenerativeModel (GEMINI) ---");
        const modelGemini = vertex_ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
        if (typeof modelGemini.embedContent === 'function') {
            console.log("✅ modelGemini.embedContent exists");
        } else {
            console.error("❌ modelGemini.embedContent does NOT exist");
        }
    } catch (e) {
        console.error("Error in Gemini check:", e);
    }

    try {
        console.log("--- Attempting generateContent for Embeddings ---");
        const model = vertex_ai.getGenerativeModel({ model: 'text-embedding-004' });
        const request = {
            contents: [{ role: 'user', parts: [{ text: 'test' }] }]
        };
        // Some SDKs might expect 'contents' array

        const result = await model.generateContent(request);
        console.log("GenerateContent Result keys:", Object.keys(result));
        console.log("GenerateContent Result:", JSON.stringify(result).substring(0, 200));

    } catch (e) {
        console.error("Error in generateContent for Embeddings:", e);
    }

    console.log("VertexAI Instance keys:", Object.keys(vertex_ai));

    try {
        console.log("--- Attempting preview.getGenerativeModel ---");
        const modelPreview = vertex_ai.preview.getGenerativeModel({ model: 'text-embedding-004' });
        console.log("Preview Model object keys:", Object.keys(modelPreview));
        console.log("Preview Model prototype keys:", Object.getOwnPropertyNames(Object.getPrototypeOf(modelPreview)));
    } catch (e) {
        console.error("Error in preview.getGenerativeModel:", e);
    }

}

debug();
