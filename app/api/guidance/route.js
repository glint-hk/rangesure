// Server-only: Google Gemini. The model may ONLY explain numbers the physics model
// already produced — it must never compute or change a number. Key stays server-side
// (process.env.GEMINI_API_KEY). If the call fails or the key is missing, falls back to
// a rule-based summary built only from the input numbers, so the UI never breaks.
const SYSTEM_PROMPT = `You are a driver-assistance guidance writer for an EV truck trip planner.
You receive numbers ALREADY computed by a deterministic physics model. Your ONLY job is to
explain them in 3-4 short, plain-language bullets a truck driver can act on. NEVER compute,
estimate, or change any number; only use numbers present in the input. Cite the numbers. If a
named climb is provided, give a safe speed range for it. Stay calm and factual; never overstate
confidence.`;

const GEMINI_MODEL = 'gemini-2.5-flash';

function fallbackTips(t) {
  const tips = [];

  if (t.distance_km != null && t.kwh_per_km != null) {
    tips.push(`This ${Math.round(t.distance_km)} km trip is estimated at ${t.kwh_per_km} kWh/km.`);
  }
  if (t.predicted_full_range_km != null && t.arrival_soc_pct != null) {
    tips.push(
      `Full-battery range is about ${Math.round(t.predicted_full_range_km)} km; expected arrival battery is ${Math.round(
        t.arrival_soc_pct
      )}%.`
    );
  }
  if (t.notable_climb) {
    const name = t.notable_climb.name ? ` at ${t.notable_climb.name}` : '';
    const grade = t.notable_climb.grade ? ` (grade ${t.notable_climb.grade})` : '';
    const speed = t.recommended_speed_kmh ? ` — hold around ${t.recommended_speed_kmh} km/h` : '';
    tips.push(`Watch the climb${name}${grade}${speed}.`);
  }
  if (t.cost_per_km != null) {
    tips.push(`Energy cost works out to ₹${t.cost_per_km}/km at the current tariff.`);
  }
  if (t.charging_needed != null) {
    tips.push(
      t.charging_needed === 'No stop'
        ? 'No charging stop should be needed for this trip.'
        : `Plan for a charging stop: ${t.charging_needed}.`
    );
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
      .map((l) => l.replace(/^[-*\d.\s]+/, '').trim())
      .filter(Boolean);

    return Response.json({ tips: tips.length ? tips : text });
  } catch (err) {
    console.error('Guidance generation error:', err);
    return Response.json({ tips: fallbackTips(tripSummary), fallback: true });
  }
}
