// Server-only: Google Gemini. The model may ONLY explain numbers the physics model
// already produced — it must never compute or change a number. Key stays server-side
// (process.env.GEMINI_API_KEY). If the call fails or the key is missing, falls back to
// a rule-based summary built only from the input numbers, so the UI never breaks.
const SYSTEM_PROMPT = `You write short driver notes for an electric-truck trip planner.
You receive numbers ALREADY computed by a deterministic physics model with a learned calibration.
Write 3-4 short, plain-language bullets a truck driver or fleet manager can act on.
Rules:
- NEVER compute, estimate, round differently or change any number. Only quote numbers exactly as
  they appear in the input, with their units.
- Cover, in this order where present: whether the battery lasts and the arrival battery; the
  charging plan (where, from what % to what %, how long); the steepest climb and the suggested
  speed; anything weather-related (heat, wind, wet road).
- No markdown, no headings, no numbering. One sentence per bullet, each on its own line.
- Be calm and factual; never overstate confidence.`;

const GEMINI_MODEL = 'gemini-2.5-flash';

// Rule-based notes built only from the input numbers — used whenever the model is
// unavailable, so the panel never sits empty or invents anything.
function fallbackTips(t) {
  const tips = [];
  if (t.charging === 'no stop needed' && t.arrival_battery_pct != null) {
    tips.push(`No charging stop is needed. You should arrive with about ${t.arrival_battery_pct}% battery.`);
  } else if (typeof t.charging === 'string' && t.charging.startsWith('not possible')) {
    tips.push('This trip cannot be completed as planned. Start with more charge or carry less load.');
  } else if (t.charging) {
    tips.push(`Charging plan: ${t.charging}.`);
  }
  if (t.steepest_climb) {
    const c = t.steepest_climb;
    const where = c.near ? ` near ${c.near}` : '';
    const speed = c.suggested_speed_kmh ? `; hold about ${c.suggested_speed_kmh} km/h` : '';
    tips.push(`The steepest climb${where} runs ${c.length_km} km at ${c.avg_grade_pct}% on average${speed}.`);
  }
  if (t.kwh_per_km != null && t.cost_per_km_inr != null) {
    tips.push(`Expect ${t.kwh_per_km} kWh/km, about ₹${t.cost_per_km_inr}/km in electricity.`);
  }
  if (t.weather) {
    const w = t.weather;
    const parts = [`around ${w.temp_c}°C`];
    if (w.max_wind_kmh != null) parts.push(`winds up to ${w.max_wind_kmh} km/h`);
    if (w.wet_road) parts.push('wet roads, which raise energy use');
    tips.push(`Conditions on the route: ${parts.join(', ')}.`);
  }
  return tips.slice(0, 4);
}

export async function POST(req) {
  let tripSummary;
  try {
    tripSummary = await req.json();
  } catch {
    return Response.json({ error: 'Invalid trip summary.' }, { status: 400 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return Response.json({ tips: fallbackTips(tripSummary), fallback: true });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(tripSummary) }] }],
          // gemini-2.5-flash is a thinking model by default — its hidden reasoning tokens
          // count against maxOutputTokens, which starved the visible reply (finishReason
          // MAX_TOKENS with 0 usable text). Guidance is a short explain-only task, so we
          // don't need the thinking budget; disabling it fixes truncation and cuts latency.
          generationConfig: { maxOutputTokens: 400, temperature: 0.4, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );

    if (!res.ok) {
      console.error('Guidance generation failed:', await res.text());
      return Response.json({ tips: fallbackTips(tripSummary), fallback: true });
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const text = parts
      .map((p) => p.text || '')
      .join('\n')
      .trim();

    // A MAX_TOKENS finish means the reply was cut off mid-sentence — a half-formed
    // guidance bullet could misstate the numbers it's citing, so treat it as a failure.
    if (!text || candidate?.finishReason === 'MAX_TOKENS') {
      return Response.json({ tips: fallbackTips(tripSummary), fallback: true });
    }

    const tips = text
      .split('\n')
      // Strip only list markers ("- ", "* ", "• ", "1. ", "2) ") — never a leading number like "156 km".
      .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
      .filter(Boolean);

    return Response.json({ tips: tips.length ? tips : text });
  } catch (err) {
    console.error('Guidance generation error:', err);
    return Response.json({ tips: fallbackTips(tripSummary), fallback: true });
  }
}
