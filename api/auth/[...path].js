const API_ORIGIN = 'https://instaclonee-5.onrender.com';
const VERCEL_GEO_HEADERS = [
  'x-vercel-ip-city',
  'x-vercel-ip-country',
  'x-vercel-ip-country-region',
  'x-vercel-ip-latitude',
  'x-vercel-ip-longitude',
  'x-forwarded-for'
];

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } }
};

export default async function authProxy(req, res) {
  const requestUrl = new URL(req.url, 'https://instaclonee-5izy.vercel.app');

  if (!requestUrl.pathname.startsWith('/api/auth/')) {
    return res.status(404).json({ error: 'Not found.' });
  }

  const headers = new Headers();
  for (const name of ['accept', 'content-type', 'cookie', 'origin', 'user-agent']) {
    const value = req.headers[name];
    if (typeof value === 'string') headers.set(name, value);
  }

  // Vercel supplies the visitor's public IP and approximate location to
  // Functions. Forward those trusted edge values to Render for consented logs.
  for (const name of VERCEL_GEO_HEADERS) {
    const value = req.headers[name];
    if (typeof value === 'string' && value.length <= 200) {
      headers.set(name, value);
    }
  }

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
    body = Buffer.isBuffer(req.body)
      ? req.body
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);
  }

  try {
    const upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, API_ORIGIN);
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

    if (req.method === 'HEAD' || upstream.status === 204 || upstream.status === 304) {
      return res.end();
    }

    return res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error('Vercel auth proxy failed:', error);
    return res.status(502).json({ error: 'The login service is temporarily unavailable.' });
  }
}
