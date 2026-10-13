const MAP_API = '/api/indoor-map/cit';

async function request(url, options = {}) {
  const response = await fetch(url, { headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.validation?.errors?.join(' ') || `Indoor map request failed (${response.status}).`);
  return body;
}

export async function loadPublishedIndoorMap() {
  const response = await fetch(`${MAP_API}/published`, { cache: 'no-cache' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Published indoor map could not be loaded.');
  return (await response.json()).map;
}

export async function loadAdminIndoorMap(token) {
  return (await request('/api/admin/indoor-map/cit', { headers: { 'x-taylor-admin-token': token } })).map;
}

export async function saveAdminIndoorMap(token, map) {
  return (await request('/api/admin/indoor-map/cit', {
    method: 'PUT',
    headers: { 'x-taylor-admin-token': token },
    body: JSON.stringify(map),
  })).map;
}

export async function publishAdminIndoorMap(token) {
  return request('/api/admin/indoor-map/cit/publish', {
    method: 'POST',
    headers: { 'x-taylor-admin-token': token },
    body: '{}',
  });
}
