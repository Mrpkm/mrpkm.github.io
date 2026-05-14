async function callGitHubModel({ apiKey, endpoint, model, messages, temperature = 0.4, apiVersion }) {
  if (!apiKey) {
    return {
      provider: 'local-fallback',
      content: 'No GitHub API key configured. Used deterministic local reasoning instead.',
    };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': apiVersion || '2026-03-10',
    },
    body: JSON.stringify({
      model,
      temperature,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub Models ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = await response.json();
  return {
    provider: 'github-models',
    content: data.choices?.[0]?.message?.content || '',
    raw: data,
  };
}

module.exports = { callGitHubModel };
