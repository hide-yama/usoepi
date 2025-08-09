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
    const { objects, true_story, selected_object_id } = await req.json();
    if (!true_story) throw new Error('true_story required');
    
    if (!apiKey) {
      // APIキーがない場合はモック応答（選択された要素を除外）
      const availableObjects = Array.isArray(objects) ? objects.filter((o: any) => o.id !== selected_object_id) : [];
      const labels = availableObjects.map((o: any) => o?.label).filter(Boolean);
      const alt1 = labels[0] ? `子供の頃、${labels[0]}が印象的だった` : '子供の頃の思い出があった';
      const alt2 = labels[1] ? `学生時代、${labels[1]}をよく見ていた` : '学生時代の記憶がある';
      return Response.json({ fakes: [alt1, alt2] }, { headers: cors() });
    }

    // 選択された要素を除外してオブジェクトリストを整形
    const availableObjects = Array.isArray(objects) 
      ? objects.filter((o: any) => o.id !== selected_object_id)
      : [];
    const objectsList = availableObjects.map((o: any) => `- ${o.label}${o.pos ? `(位置:${o.pos})` : ''}`).join('\n');

    // OpenAI APIを使用してフェイク生成
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `選択されなかった要素（フェイク生成用）:\n${objectsList}\n\n役割: 上記要素から1つだけを選んで、ユーザ自身の過去の体験文章形式の架空エピソードを2本（各20-40字程度）作成。\n\n条件:\n- 1本につき1つの要素のみ使用\n- ユーザ自身の体験として語る（「私が〜」「私の〜」「〜していた」）\n- 過去の体験文章形式（「〜だった」「〜していた」「〜したことがある」）\n- 具体的でリアルな過去の体験\n\n禁止事項:\n- 複数要素の組み合わせ\n- 第三者視点\n\n例:\n「子供の頃、祖母の着物の人形が怖かった」（人形要素のみ）\n「学生時代、古いレコードをよく聞いていた」（レコード要素のみ）\n\n本文のみ、番号付きで2本。`
          },
          {
            role: 'user',
            content: `実話: ${true_story}`
          }
        ],
        max_tokens: 400,
        temperature: 0.8,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error('OpenAI API error');
    }

    const data = await openaiResponse.json();
    const content = data.choices[0].message.content;
    
    // 番号付きの2本を抽出
    const fakes: string[] = [];
    const lines = content.split('\n').filter((line: string) => line.trim());
    
    for (const line of lines) {
      // 1. または 2. で始まる行を抽出
      const match = line.match(/^[12]\.\s*(.+)/);
      if (match) {
        fakes.push(match[1].trim());
      }
    }
    
    // 2本取得できなかった場合はモック（選択された要素を除外）
    if (fakes.length < 2) {
      const labels = availableObjects.map((o: any) => o?.label).filter(Boolean);
      return Response.json({ 
        fakes: [
          labels[0] ? `子供の頃、${labels[0]}が印象的だった` : '子供の頃の思い出があった',
          labels[1] ? `学生時代、${labels[1]}をよく見ていた` : '学生時代の記憶がある'
        ] 
      }, { headers: cors() });
    }
    
    return Response.json({ fakes: fakes.slice(0, 2) }, { headers: cors() });
  } catch (e) {
    console.error('Fakes API error:', e);
    return new Response('Bad Request', { status: 400, headers: cors() });
  }
}


