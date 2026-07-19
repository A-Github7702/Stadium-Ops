export default async function handler(req, res) {
  // Allow POST requests only
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { gateKey, telemetry } = req.body;
    if (!gateKey || !telemetry || !telemetry.gates) {
      return res.status(400).json({ error: 'Missing gateKey or telemetry data' });
    }

    const activeGateData = telemetry.gates[gateKey];
    if (!activeGateData) {
      return res.status(404).json({ error: `Gate ${gateKey} not found in telemetry` });
    }

    // Calculate distance to other gates
    const gatesList = Object.entries(telemetry.gates).map(([key, gate]) => {
      const dx = activeGateData.coords[0] - gate.coords[0];
      const dy = activeGateData.coords[1] - gate.coords[1];
      const dz = activeGateData.coords[2] - gate.coords[2];
      const distance = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz) * 20);
      return {
        key,
        name: gate.name,
        congestion: gate.congestion,
        status: gate.status,
        distance
      };
    });

    const prompt = `You are the Lusail Stadium Operations AI. Analyze the crowd occupancy telemetry for the active gate and all other gates.
Active Gate:
- Key: ${gateKey}
- Name: ${activeGateData.name}
- Congestion Level: ${activeGateData.congestion}%
- Status: ${activeGateData.status}

All Available Gates (including active gate and possible alternative gates with distance from the active gate):
${JSON.stringify(gatesList, null, 2)}

Your task is to generate:
1. A clear warning message explaining the congestion state of the active gate.
2. A recommended alternative gate from the list (choose the best available gate that has lower congestion, preferably 'clear' or 'moderate', and is relatively close). If the active gate is not congested, or no better alternative is available, return null.
3. A detailed, professional reroute recommendation explaining why this alternative gate is recommended.

Respond strictly in JSON format matching this schema:
{
  "warningText": "string describing the congestion warning or current state of the active gate",
  "recommendedGateKey": "string representing the recommended gate key (e.g. gateB), or null if no alternative is available or active gate is clear",
  "recommendationText": "string describing the reroute recommendation and reasoning"
}
Do not include any markdown formatting, code blocks (e.g. \`\`\`json), or additional text outside the JSON object.`;

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_ANTIGRAVITY_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
    }

    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return res.status(apiResponse.status).json({ error: `Gemini API error: ${errorText}` });
    }

    const data = await apiResponse.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(500).json({ error: 'Empty response from Gemini API.' });
    }

    const parsed = JSON.parse(text.trim());
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Serverless function error:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
