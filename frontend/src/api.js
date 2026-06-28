const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Silently wake up the Render server when the app loads (prevents cold-start delay on first submission)
export async function warmUpServer() {
  try {
    await fetch(`${API_BASE}/api/health`, { method: 'GET' });
  } catch (_) {
    // Intentionally silent — this is a best-effort pre-warm
  }
}

// Fetch with automatic retry — handles Render free-tier cold starts (up to 60s boot time)
async function fetchWithRetry(url, options, retries = 3, delayMs = 8000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);

      // On a server error (5xx), retry — could be a cold-start 503/504
      if (res.status >= 500 && attempt < retries) {
        console.warn(`[Nexus Risk] Attempt ${attempt} got ${res.status}, retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }

      // On a validation error (4xx), don't retry — read and throw with detail
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          detail = body.detail || JSON.stringify(body);
        } catch (_) { /* ignore JSON parse error */ }
        throw new Error(`Server error (${res.status}): ${detail}`);
      }

      return res.json();
    } catch (err) {
      // Network failure (server sleeping, CORS, no internet)
      if (attempt < retries) {
        console.warn(`[Nexus Risk] Attempt ${attempt} failed: ${err.message}. Retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        throw err; // All retries exhausted — bubble up
      }
    }
  }
}

export async function submitPrediction(inputs) {
  return fetchWithRetry(`${API_BASE}/api/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputs),
  });
}

export async function fetchHistory(search = '', sort = 'newest') {
  const res = await fetch(`${API_BASE}/api/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ search, sort }),
  });
  if (!res.ok) throw new Error('History fetch error');
  return res.json();
}

export async function fetchHistoryRecord(id) {
  const res = await fetch(`${API_BASE}/api/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error('Record not found');
  return res.json();
}

export async function deleteHistoryRecord(id) {
  const res = await fetch(`${API_BASE}/api/history/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error('Delete error');
  return res.json();
}

export async function sendChat(question, applicantData, predictionResults, caseLoaded, apiKey) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      applicant_data: applicantData,
      prediction_results: predictionResults,
      case_loaded: caseLoaded,
      api_key: apiKey,
    }),
  });
  if (!res.ok) throw new Error('Chat server error');
  return res.json();
}
