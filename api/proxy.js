export const config = {
  runtime: 'edge',
  maxDuration: 30,
};

function isRussianDomain(hostname) {
  if (!hostname) return false;
  return hostname.endsWith('.ru') || hostname.endsWith('.рф') || hostname === 'yandex.ru' || hostname === 'vk.com' || hostname === 'mail.ru';
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    let urlParam = searchParams.get('url');
    
    if (!urlParam) {
      return new Response('Missing url parameter', { status: 400 });
    }

    if (!urlParam.startsWith('http')) {
      urlParam = 'https://' + urlParam;
    }

    let target;
    try {
      target = new URL(urlParam);
    } catch {
      return new Response('Invalid URL', { status: 400 });
    }
    
    if (isRussianDomain(target.hostname)) {
      return new Response('Russian domains blocked', { status: 403 });
    }

    const headers = new Headers();
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    headers.set('Accept', '*/*');

    const response = await fetch(target.href, {
      method: 'GET',
      headers,
    });

    const text = await response.text();

    return new Response(text, {
      status: response.status,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response('Error: ' + error.message, { status: 500 });
  }
}