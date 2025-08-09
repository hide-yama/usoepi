export const runtime = 'edge';

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  } as const;
}

export async function OPTIONS() {
  return new Response(null, { headers: cors() });
}

export async function POST(req: Request) {
  try {
    const { story } = await req.json();
    const s = typeof story === 'string' ? story : '';
    const trimmed = s.slice(0, 160) + (s.length > 160 ? '…' : '');
    return Response.json({ story: trimmed }, { headers: cors() });
  } catch (e) {
    return new Response('Bad Request', { status: 400, headers: cors() });
  }
}


