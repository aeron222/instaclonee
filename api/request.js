const API_ORIGIN = 'https://instaclonee-5.onrender.com';
const VERCEL_GEO_HEADERS = [
  'x-vercel-ip-city',
  'x-vercel-ip-country',
  'x-vercel-ip-country-region',
  'x-vercel-ip-latitude',
  'x-vercel-ip-longitude',
  'x-forwarded-for'
];

export const config = { api: { bodyParser: false } };

async function readBody(req) {
  if (['GET', 'HEAD'].includes(req.method || 'GET')) return undefined;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export default async function apiProxy(req, res) {
  let requestUrl;
  try {
    requestUrl = new URL(req.url || '/', 'https://instaclonee-eight.vercel.app');
  } catch {
    return res.status(400).json({ error: 'Invalid API request.' });
  }

  // Route through one concrete Vercel function so nested /api paths resolve
  // consistently while keeping the browser's same-origin URL and session cookie.
  const targetPath = requestUrl.searchParams.get('path');
  if (!targetPath || !targetPath.startsWith('/api/') || targetPath.startsWith('//')) {
    return res.status(400).json({ error: 'Invalid API route.' });
  }

  const upstreamUrl = new URL(targetPath, API_ORIGIN);
  for (const [name, value] of requestUrl.searchParams) {
    if (name !== 'path') upstreamUrl.searchParams.append(name, value);
  }

  const headers = new Headers();
  for (const name of ['accept', 'content-type', 'cookie', 'origin', 'user-agent']) {
    const value = req.headers[name];
    if (typeof value === 'string') headers.set(name, value);
  }
  headers.set('x-insta-vercel-proxy', '1');
  for (const name of VERCEL_GEO_HEADERS) {
    const value = req.headers[name];
    if (typeof value === 'string' && value.length <= 200) headers.set(name, value);
  }

  try {
    const body = await readBody(req);
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body
    });

    res.status(upstream.status);
    for (const name of ['content-type', 'cache-control', 'location']) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    const cookies = upstream.headers.getSetCookie?.() || [];
    if (cookies.length) res.setHeader('set-cookie', cookies);
    if (req.method === 'HEAD' || upstream.status === 204 || upstream.status === 304) return res.end();
    return res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error('Vercel API proxy failed:', error?.name || 'Error');
    return res.status(502).json({ error: 'The API service is temporarily unavailable.' });
  }
}
