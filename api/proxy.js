export const config = {
  runtime: 'edge',
};

function isRussianDomain(hostname) {
  if (!hostname) return false;
  return hostname.endsWith('.ru') || hostname.endsWith('.рф');
}

function parseUrl(input) {
  try {
    if (!input.startsWith('http')) {
      input = 'https://' + input;
    }
    return new URL(input);
  } catch {
    return null;
  }
}

export default async function handler(request) {
  let urlParam;
  try {
    urlParam = new URL(request.url).searchParams.get('url');
  } catch {
    urlParam = null;
  }
  
  if (!urlParam) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsedUrl = parseUrl(urlParam);
  if (!parsedUrl) {
    return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  if (isRussianDomain(parsedUrl.hostname)) {
    return new Response(JSON.stringify({ error: 'Russian domains blocked' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch(parsedUrl.toString(), {
      redirect: 'follow',
    });

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}