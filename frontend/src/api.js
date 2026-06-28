const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function submitPrediction(inputs) {
  const res = await fetch(`${API_BASE}/api/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputs),
  });
  if (!res.ok) throw new Error('Backend inference error');
  return res.json();
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
