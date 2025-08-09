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
    const { objects, true_story } = await req.json();
    if (!true_story) throw new Error('true_story required');
    // 簡易スタブ：別要素を使ったそれっぽい文
    const labels = Array.isArray(objects) ? objects.map((o: any) => o?.label).filter(Boolean) : [];
    const alt1 = labels[0] ? `${labels[0]}にまつわる小さなきっかけがあって…` : '棚の上の本がきっかけで…';
    const alt2 = labels[1] ? `${labels[1]}を見ると昔の季節を思い出す…` : '古い写真立てを見ると別の季節を思い出す…';
    return Response.json({ fakes: [alt1, alt2] }, { headers: cors() });
  } catch (e) {
    return new Response('Bad Request', { status: 400, headers: cors() });
  }
}


