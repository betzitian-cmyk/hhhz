import dotenv from "dotenv";
dotenv.config();

async function testGroqModels() {
  const apiKey = process.env.GROQ_API_KEY;
  
  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    const data = await response.json();
    console.log("Model IDs:", data.data.map(m => m.id).join(", "));
  } catch (err) {
    console.error("Error:", err);
  }
}

testGroqModels();
