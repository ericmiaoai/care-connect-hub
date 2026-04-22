/**
 * CareSync — Netlify Serverless Function: process-avs
 * ====================================================
 * Route: POST /.netlify/functions/process-avs
 *
 * Responsibilities:
 *   1. Authenticate the caller using their Supabase JWT (security gate).
 *   2. Accept a base64-encoded AVS image from the React frontend.
 *   3. Call the Gemini 1.5 Flash Vision API with a strict prompt that enforces
 *      our approved JSON Data Contract.
 *   4. Validate the raw AI response against the Zod schema.
 *   5. Return the validated JSON payload to the frontend staging UI.
 *
 * ⚠️  CRITICAL: This function has NO database connection.
 *     It does NOT write to Supabase. It does NOT log PHI.
 *     It is a pure, stateless transformation function.
 *     Secret API keys are stored as Netlify environment variables ONLY.
 */

import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

// ---------------------------------------------------------------------------
// 1. ENVIRONMENT VALIDATION
// Fail fast at cold-start if secrets are missing. Never expose these to client.
// ---------------------------------------------------------------------------
const GEMINI_API_KEY     = process.env.GEMINI_API_KEY!;
const SUPABASE_URL       = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY  = process.env.SUPABASE_ANON_KEY!;

if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "[process-avs] Missing required environment variables. " +
    "Check Netlify environment settings."
  );
}

// ---------------------------------------------------------------------------
// 2. ZOD SCHEMA — The Enforced AI Data Contract
// This is the single source of truth. Matches the contract defined in Phase 0.
// If the VLM output fails this validation, we reject it and return an error.
// ---------------------------------------------------------------------------
const AVSContractSchema = z.object({
  avs_metadata: z.object({
    visit_date:    z.string().describe("ISO 8601 date (YYYY-MM-DD)"),
    provider_name: z.string()
  }),
  medications: z.array(z.object({
    name:      z.string(),
    dosage:    z.string(),
    frequency: z.string(),
    reason:    z.string().nullable().optional()
  })),
  upcoming_appointments: z.array(z.object({
    specialty_or_provider: z.string(),
    date_time:             z.string(),
    location:              z.string().nullable().optional()
  })),
  care_instructions: z.array(z.string()),
  status: z.literal("pending_human_review")
});

export type AVSContract = z.infer<typeof AVSContractSchema>;

// ---------------------------------------------------------------------------
// 3. THE STRICT VLM PROMPT
// This is the system instruction we send to Gemini alongside the image.
// It is deterministic and leaves zero ambiguity about the expected output format.
// ---------------------------------------------------------------------------
const STRICT_EXTRACTION_PROMPT = `
You are a clinical document parser. Your ONLY job is to extract structured data 
from a printed After Visit Summary (AVS) document.

You MUST respond with a single, valid JSON object that conforms EXACTLY to the 
following structure. Do NOT include any explanation, preamble, markdown code fences, 
or commentary. Respond with raw JSON only.

Required JSON structure:
{
  "avs_metadata": {
    "visit_date": "<ISO 8601 date YYYY-MM-DD, or empty string if not found>",
    "provider_name": "<doctor or facility name, or empty string if not found>"
  },
  "medications": [
    {
      "name": "<exact medication name>",
      "dosage": "<dosage e.g. 10mg>",
      "frequency": "<how often e.g. Once daily>",
      "reason": "<reason if stated, or null>"
    }
  ],
  "upcoming_appointments": [
    {
      "specialty_or_provider": "<specialty or doctor name>",
      "date_time": "<extracted date and time as a string>",
      "location": "<location if stated, or null>"
    }
  ],
  "care_instructions": [
    "<one actionable care instruction per string item>"
  ],
  "status": "pending_human_review"
}

Rules:
- The "status" field MUST always be exactly the string "pending_human_review".
- If a section has no data (e.g. no upcoming appointments), use an empty array [].
- Never infer or hallucinate data that is not explicitly on the document.
- Never include patient name, date of birth, address, insurance ID, or any 
  other personally identifying information in your output.
`.trim();

// ---------------------------------------------------------------------------
// 4. CORS HEADERS
// Restrict to our app's domain in production.
// ---------------------------------------------------------------------------
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  process.env.APP_URL || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ---------------------------------------------------------------------------
// 5. MAIN HANDLER
// ---------------------------------------------------------------------------
export const handler: Handler = async (event: HandlerEvent) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  // Only accept POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  // ── SECURITY GATE ─────────────────────────────────────────────────────────
  // Validate the caller's Supabase JWT before doing any work.
  // This ensures only authenticated CareSync users can trigger the VLM.
  const authHeader = event.headers["authorization"] ?? "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Unauthorized: Missing auth token." })
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Unauthorized: Invalid or expired session." })
    };
  }
  // ── END SECURITY GATE ──────────────────────────────────────────────────────

  // Parse and validate the request body
  let imageBase64: string;
  let mimeType: "image/jpeg" | "image/png" | "image/webp";

  try {
    const body = JSON.parse(event.body ?? "{}");
    if (!body.imageBase64) throw new Error("Missing imageBase64 field.");
    imageBase64 = body.imageBase64;
    mimeType    = body.mimeType ?? "image/jpeg";
  } catch (e) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Bad Request: Invalid JSON body." })
    };
  }

  // ── GEMINI API CALL ────────────────────────────────────────────────────────
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent([
      STRICT_EXTRACTION_PROMPT,
      {
        inlineData: {
          mimeType,
          data: imageBase64
        }
      }
    ]);

    const rawText = result.response.text().trim();

    // Strip any accidental markdown code fences the model may add
    const cleanJson = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // ── ZOD VALIDATION — Enforce the Data Contract ─────────────────────────
    const parsed = AVSContractSchema.safeParse(JSON.parse(cleanJson));

    if (!parsed.success) {
      console.error("[process-avs] Schema validation failed:", parsed.error.flatten());
      return {
        statusCode: 422,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "AI output did not conform to the required data contract. " +
                 "Please try scanning the document again.",
          details: parsed.error.flatten()
        })
      };
    }
    // ── END ZOD VALIDATION ─────────────────────────────────────────────────

    // ✅ Clean, validated payload — return to frontend staging UI only.
    // This data is NEVER written to any database from this function.
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data)
    };

  } catch (err: any) {
    console.error("[process-avs] Gemini API error:", err?.message);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "The AI processing service is temporarily unavailable. Please try again."
      })
    };
  }
};
