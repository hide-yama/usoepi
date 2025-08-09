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
    // ここではスタブ応答（モック）
    const body = await req.json();
    if (!body?.image_base64) throw new Error('image_base64 required');
    return Response.json({
      objects: [
        { id: 'o1', label: '赤いマグカップ', color: '赤', pos: '左前', related: ['テーブル'] },
        { id: 'o2', label: 'サボテン', color: '緑', pos: '右奥', related: ['窓'] },
        { id: 'o3', label: 'レコードプレーヤー', color: '黒', pos: '中央', related: ['棚'] },
      ],
    }, { headers: cors() });
  } catch (e) {
    return new Response('Bad Request', { status: 400, headers: cors() });
  }
}


