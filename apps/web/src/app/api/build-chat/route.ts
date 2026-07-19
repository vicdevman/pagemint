import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const SCHEMA_PROMPT = `You are an expert Website-as-a-Service assistant for Monad.
Extract the details for a token or protocol landing page from the user's prompt.
Never invent an address. If a required address is missing, return an empty string for that field and ask for it in description.
Always respond with ONLY a valid JSON object matching exactly this schema:
{
  "title": "string - the project name",
  "description": "string - short catchy subtitle",
  "contractAddress": "string - valid 0x hex address",
  "gateToken": "string - ERC20 token address for gating",
  "minTokenToUnlock": number,
  "roadmapText": "string - markdown roadmap",
  "themeColor": "string - hex color e.g. #0099ff"
}
Do not include any other text, only the JSON.`;

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  if (typeof prompt !== "string" || prompt.length > 8_000) return NextResponse.json({ error: "Prompt must be a short text request." }, { status: 400 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama3-8b-8192",
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
