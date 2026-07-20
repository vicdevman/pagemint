import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const SCHEMA_PROMPT = `You are an expert Web3 landing page designer for the Monad network.
Your job is to chat with the creator, understand their contract (token or protocol), and generate a customized page configuration.

Process:
1. Ask follow-up questions to gather details (e.g. contract address, project name, description, gate token address, min tokens, theme color, roadmap).
2. You can have a normal conversation. Ask questions to get the required information first.
3. Only append the JSON configuration block when you have the contract address and project name.

If you are ready to generate or update the landing page configuration, include a valid JSON block inside markdown code blocks at the very end of your response:
\`\`\`json
{
  "title": "string - project name",
  "description": "string - catchy tagline",
  "contractAddress": "string - target contract address",
  "gateToken": "string - ERC20 gate token address",
  "minTokenToUnlock": number,
  "roadmapText": "string - markdown roadmap",
  "themeColor": "string - hex color e.g. #A100FF"
}
\`\`\`
Ensure your conversational response is helpful, engaging, and guides the creator.`;

export async function POST(req: NextRequest) {
  let prompt: string;
  try {
    const body = await req.json();
    prompt = body.prompt;
  } catch {
    return NextResponse.json({ error: "Invalid JSON input" }, { status: 400 });
  }

  if (typeof prompt !== "string" || prompt.length > 8_000) return NextResponse.json({ error: "Prompt must be a short text request." }, { status: 400 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });
  }

  let model = "groq/compound";
  let response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SCHEMA_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!response.ok) {
    // Fallback if groq/compound is not recognized by Groq
    model = "llama-3.1-8b-instant";
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SCHEMA_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
        stream: true,
      }),
    });
  }

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: text }, { status: response.status });
  }

  // Stream the raw SSE response from Groq directly to the client
  return new NextResponse(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
