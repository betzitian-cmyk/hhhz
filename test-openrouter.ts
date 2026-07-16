import dotenv from "dotenv";
dotenv.config();

async function testOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("No OPENROUTER_API_KEY found in .env");
    return;
  }
  
  console.log("Testing OpenRouter API...");
  
  const payload = {
    model: "openai/gpt-oss-20b:free",
    messages: [
      {
        role: "user",
        content: "Hello, this is a test. Reply with 'OK'."
      }
    ],
  };

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    
    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

testOpenRouter();
