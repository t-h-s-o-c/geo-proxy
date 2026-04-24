export const config = {
  runtime: 'edge',
};

function isRussianDomain(hostname) {
  if (!hostname) return false;
  return hostname.endsWith('.ru') || hostname.endsWith('.рф');
}

export default async function handler(req) {
  const urlParam = req.nextUrl.searchParams.get('url');
  
  if (!urlParam) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const targetUrl = urlParam.startsWith('http') ? urlParam : 'https://' + urlParam;
  
  if (isRussianDomain(new URL(targetUrl).hostname)) {
    return new Response(JSON.stringify({ error: 'Russian domains blocked' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch(targetUrl);

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}