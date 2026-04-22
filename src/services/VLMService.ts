/**
 * CareSync — VLMService.ts
 * ========================
 * The single abstraction layer between the React UI and the VLM backend.
 *
 * This is the "wall outlet" pattern: the Scan UI plugs into this service
 * and never knows whether the model is running on a cloud API or locally
 * on the device. Swap providers by changing VITE_VLM_PROVIDER in .env.
 *
 * Supported providers:
 *   "api"   → Routes through our Netlify serverless function → Gemini Flash
 *   "mock"  → Returns a hardcoded synthetic AVS payload instantly (zero API cost)
 *   "local" → Future: routes to locally hosted Qwen2.5-VL via WebGPU (v2 native app)
 */

import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";

// ---------------------------------------------------------------------------
// The Zod Contract — identical to the one in the Netlify function.
// This is the frontend's guard against malformed payloads.
// ---------------------------------------------------------------------------
export const AVSContractSchema = z.object({
  avs_metadata: z.object({
    visit_date:    z.string(),
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
// VLM Provider config — reads from environment variable
// ---------------------------------------------------------------------------
type VLMProvider = "api" | "mock" | "local";
const PROVIDER = (import.meta.env.VITE_VLM_PROVIDER ?? "mock") as VLMProvider;

// ---------------------------------------------------------------------------
// PROVIDER: "mock"
// Returns a hardcoded synthetic AVS payload.
// Use during development and UI testing — zero API cost, zero privacy risk.
// ---------------------------------------------------------------------------
const MOCK_PAYLOAD: AVSContract = {
  avs_metadata: {
    visit_date:    "2026-04-20",
    provider_name: "Dr. Jane Smith, MD — Valley General Hospital"
  },
  medications: [
    {
      name:      "Lisinopril",
      dosage:    "10mg",
      frequency: "Once daily in the morning",
      reason:    "Blood pressure management"
    },
    {
      name:      "Metformin",
      dosage:    "500mg",
      frequency: "Twice daily with meals",
      reason:    "Type 2 diabetes management"
    }
  ],
  upcoming_appointments: [
    {
      specialty_or_provider: "Cardiology — Dr. R. Patel",
      date_time:             "May 5, 2026 at 10:30 AM",
      location:              "Heart & Vascular Center, Suite 200"
    },
    {
      specialty_or_provider: "Primary Care Follow-Up",
      date_time:             "May 19, 2026 at 2:00 PM",
      location:              null
    }
  ],
  care_instructions: [
    "Rest for 48 hours and avoid strenuous activity.",
    "Maintain a low-sodium diet (less than 1500mg per day).",
    "Monitor blood pressure daily and log readings.",
    "Return to the ER immediately if chest pain or shortness of breath occurs."
  ],
  status: "pending_human_review"
};

// ---------------------------------------------------------------------------
// PROVIDER: "api"
// Routes the image through our secure Netlify serverless function.
// The Netlify function holds the Gemini API key — never exposed to the browser.
// ---------------------------------------------------------------------------
async function processViaAPI(imageBase64: string, mimeType: string): Promise<AVSContract> {
  // Retrieve the user's current session token to authenticate the serverless call
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You must be logged in to scan a document.");
  }

  const response = await fetch("/.netlify/functions/process-avs", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ imageBase64, mimeType })
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      errBody.error ?? `Server error: ${response.status} ${response.statusText}`
    );
  }

  const rawPayload = await response.json();

  // Re-validate on the client side even though the server already validated.
  // Defense-in-depth: never trust network responses blindly.
  const parsed = AVSContractSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new Error("Received an invalid data contract from the server. Please try again.");
  }

  return parsed.data;
}

// ---------------------------------------------------------------------------
// PROVIDER: "local" (Future v2 — Qwen2.5-VL via WebGPU/MLC-LLM)
// Placeholder for the production on-device inference path.
// ---------------------------------------------------------------------------
async function processViaLocalModel(_imageBase64: string): Promise<AVSContract> {
  throw new Error(
    "Local VLM inference is not yet implemented in this build. " +
    "Set VITE_VLM_PROVIDER=api or VITE_VLM_PROVIDER=mock in your .env file."
  );
}

// ---------------------------------------------------------------------------
// PUBLIC API — The single "wall outlet" the Scan UI plugs into.
// ---------------------------------------------------------------------------

/**
 * Takes a base64-encoded image of an After Visit Summary and returns a 
 * validated AVSContract JSON object for the Human-In-The-Loop staging UI.
 *
 * This function DOES NOT touch the database.
 * The returned payload must be reviewed and approved by a human before
 * any data is committed to permanent storage.
 */
export async function processAVSImage(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<AVSContract> {
  console.info(`[VLMService] Processing image via provider: "${PROVIDER}"`);

  switch (PROVIDER) {
    case "api":
      return processViaAPI(imageBase64, mimeType);
    case "mock":
      // Simulate real async latency so the UI loading states work correctly
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return MOCK_PAYLOAD;
    case "local":
      return processViaLocalModel(imageBase64);
    default:
      throw new Error(`[VLMService] Unknown provider: "${PROVIDER}"`);
  }
}
