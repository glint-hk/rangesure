// Server-only: Google Gemini "what-if" box. Unlike /api/guidance (which only
// summarizes numbers already on screen), this lets the driver/manager ask a
// free-form question — but the model is still forbidden from inventing figures:
// it may only reason over the trip numbers and calibration coefficients it's given,
// and must say so. On any failure it returns a plain refusal, never a guessed answer.
const SYSTEM_PROMPT = `You are a what-if assistant for an EV truck trip planner. You are given the
CURRENT trip's numbers (already computed by a deterministic physics model plus a learned
calibration correction) and the calibration model's coefficients. Answer the driver/fleet
manager's question in 2-3 short sentences.
Rules:
- You may reason qualitatively about how a change (more payload, later departure, a different
  vehicle, etc.) would likely move the given numbers, using the coefficients' signs/magnitudes
  as a guide.
- NEVER state a new precise number (kWh/km, range, arrival %, cost) that was not already present
  in the input — you are not allowed to compute new figures, only reason about direction and
  rough magnitude in words (e.g. "would use somewhat more energy", not "would use 0.91 kWh/km").
- Always end by noting that an exact answer requires re-running the trip planner.
- If the question is unrelated to this trip, say so briefly and decline.
- Stay factual and concise. No markdown, no bullet points — plain sentences.`;

const GEMINI_MODEL = 'gemini-2.5-flash';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { question, trip, calibration } = body || {};
  if (!question || typeof question !== 'string') {
    return Response.json({ error: 'A question is required.' }, { status: 400 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return Response.json({
      answer: "Ask is unavailable right now (no model configured) — the numbers above are still accurate.",
      fallback: true,
    });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: JSON.stringify({ trip, calibration, question }),
                },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 300, temperature: 0.4, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );

    if (!res.ok) {
      console.error('Ask generation failed:', await res.text());
      return Response.json({
        answer: 'Ask is unavailable right now — the numbers above are still accurate.',
        fallback: true,
      });
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('\n').trim();

    if (!text || candidate?.finishReason === 'MAX_TOKENS') {
      return Response.json({
        answer: 'Ask is unavailable right now — the numbers above are still accurate.',
        fallback: true,
      });
    }

    return Response.json({ answer: text });
  } catch (err) {
    console.error('Ask generation error:', err);
    return Response.json({
      answer: 'Ask is unavailable right now — the numbers above are still accurate.',
      fallback: true,
    });
  }
}
