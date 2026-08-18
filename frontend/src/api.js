export const getSummary = async () => {
  const response = await fetch('/api/summary');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

export const refreshSummary = async () => {
  const response = await fetch('/api/refresh', { method: 'POST' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};
