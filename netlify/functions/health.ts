/**
 * CareSync — Netlify Serverless Function: health
 * ===============================================
 * Route: GET /.netlify/functions/health
 *
 * Liveness check for the Netlify functions layer. Returns 200 while the
 * function runtime is healthy. No authentication required — this endpoint
 * is intentionally public so external monitors (UptimeRobot, etc.) can
 * poll it without credentials.
 *
 * Does NOT check Supabase or Gemini connectivity — dependency checks would
 * cause false negatives when those services have outages unrelated to
 * CareSync's own deployment.
 */

import type { Handler } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  process.env.APP_URL || "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      status:    "ok",
      service:   "caresync-netlify",
      timestamp: new Date().toISOString(),
    }),
  };
};
