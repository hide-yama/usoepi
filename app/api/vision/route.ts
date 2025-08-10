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
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('Vision API - API Key exists:', !!apiKey);
    if (!apiKey) {
      // APIキーがない場合はモック応答
      const body = await req.json();
      if (!body?.image_base64) throw new Error('image_base64 required');
      return Response.json({
        objects: [
          { id: 'o1', label: '赤いマグカップ', color: '赤', pos: '左前', related: ['テーブル'] },
          { id: 'o2', label: 'サボテン', color: '緑', pos: '右奥', related: ['窓'] },
          { id: 'o3', label: 'レコードプレーヤー', color: '黒', pos: '中央', related: ['棚'] },
        ],
      }, { headers: cors() });
    }

    const body = await req.json();
    if (!body?.image_base64) throw new Error('image_base64 required');
    
    console.log('Vision API - Image data length:', body.image_base64.length);
    console.log('Vision API - Image starts with:', body.image_base64.substring(0, 50));

    // OpenAI Vision APIを使用
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'あなたは写真内の物体を識別するエキスパートです。写真に写っている人物、物体、植物、道具、家具、小物などを最大7個まで検出してください。\n\n重要なルール:\n- 同じ種類の物体が複数あっても、1つのタグのみ作成してください\n- 例: フィギュアが5体あっても「フィギュア」は1つだけ\n- 異なる種類の物体のみを区別してタグ付け\n\n結果は以下のJSON配列で出力してください。他のテキストは一切追加しないでください。\n\n[\n  {\n    "id": "o1",\n    "label": "物体の名称",\n    "pos": "位置(左、中央、右など)",\n    "related": ["関連する物体"]\n  }\n]'
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: body.image_base64
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error status:', openaiResponse.status);
      console.error('OpenAI API error response:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }
      
      throw new Error(`OpenAI API error (${openaiResponse.status}): ${errorData.error?.message || errorText}`);
    }

    const data = await openaiResponse.json();
    const content = data.choices[0].message.content;
    console.log('OpenAI Vision response:', content);
    
    try {
      // JSON形式で返却されることを期待
      let parsed;
      
      // JSONだけを抽出するための正規表現
      const jsonMatch = content.match(/\[.*\]/s);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
      
      // データを正規化
      const objects = parsed.map((obj: any, index: number) => ({
        id: obj.id || `o${index + 1}`,
        label: obj.label || obj.name || '未知の物体',
        color: obj.color || '',
        pos: obj.pos || obj.position || '',
        related: obj.related || []
      }));
      
      console.log('Parsed objects:', objects);
      return Response.json({ objects }, { headers: cors() });
    } catch (parseError) {
      console.error('Parse error:', parseError);
      console.error('Raw content:', content);
      // パースエラーの場合はモック応答
      return Response.json({
        objects: [
          { id: 'o1', label: '物体1', color: '不明', pos: '中央', related: [] },
          { id: 'o2', label: '物体2', color: '不明', pos: '右', related: [] },
        ],
      }, { headers: cors() });
    }
  } catch (e) {
    console.error('Vision API error:', e);
    return new Response('Bad Request', { status: 400, headers: cors() });
  }
}


