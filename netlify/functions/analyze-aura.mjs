const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': process.env.PUBLIC_SITE_URL || '*',
  },
  body: JSON.stringify(body),
});

const normalizeScores = (input) => {
  const keys = ['POSITIVE', 'CALM', 'ENERGETIC', 'DEEP'];
  const raw = keys.map((key) => Math.max(0, Math.min(100, Number(input?.[key]) || 0)));
  const total = raw.reduce((sum, value) => sum + value, 0);
  if (!total) throw new Error('Invalid score payload');
  const scores = raw.map((value) => Math.round((value / total) * 100));
  scores[0] += 100 - scores.reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(keys.map((key, index) => [key, scores[index]]));
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.GEMINI_API_KEY) return json(503, { error: 'Aura analyzer is not configured' });

  let text;
  try {
    text = JSON.parse(event.body || '{}').text?.trim();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }
  if (!text || text.length > 180) return json(400, { error: 'Text must be between 1 and 180 characters' });

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const prompt = [
    'You analyze a short Korean or English reflection from an art or community gathering.',
    'Return only JSON with four integer scores that total exactly 100:',
    '{"POSITIVE":0,"CALM":0,"ENERGETIC":0,"DEEP":0}',
    'Use the full range and infer emotional texture without judging or diagnosing the writer.',
    `Reflection: ${JSON.stringify(text)}`,
  ].join('\n');

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    });
    if (!response.ok) throw new Error(`Gemini responded with ${response.status}`);
    const result = await response.json();
    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text;
    return json(200, { scores: normalizeScores(JSON.parse(raw)) });
  } catch (error) {
    console.error('Aura analysis failed', error);
    return json(502, { error: 'Aura analysis failed' });
  }
};
