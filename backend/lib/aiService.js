// backend/lib/aiService.js
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export async function generateMealPlan(text, allergies = []) {
  // 90 second timeout — the 4-stage pipeline can take up to 30s
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 120000); // 2 min

  const res = await fetch(`${AI_SERVICE_URL}/ai/generate-plan`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ text, allergies }),
    signal:  controller.signal,
  });
  clearTimeout(timeout);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `AI service error: ${res.status}`);
  }
  return res.json();
}

export async function parseInput(text, allergies = []) {
  const res = await fetch(`${AI_SERVICE_URL}/ai/parse-input`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ text, allergies }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `AI service error: ${res.status}`);
  }
  return res.json();
}

export async function checkAIHealth() {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/ai/health`);
    return res.ok;
  } catch {
    return false;
  }
}