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
    const { story } = await req.json();
    const s = typeof story === 'string' ? story : '';
    
    if (!apiKey || !s) {
      // APIキーがない場合は単純なトリミング
      const trimmed = s.slice(0, 160) + (s.length > 160 ? '…' : '');
      return Response.json({ story: trimmed }, { headers: cors() });
    }

    // OpenAI APIを使用して整形
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
            content: 'ユーザの実話を過去の体験文章に変換してください。20-40字程度で、「〜だった」「〜していた」「〜したことがある」のような過去の体験・状態を表す文章に。個人名・会社名は一般化。本文のみ、です調。例：「大学時代、毎日赤いマグカップでコーヒーを飲んでいた」'
          },
          {
            role: 'user',
            content: s
          }
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error('OpenAI API error');
    }

    const data = await openaiResponse.json();
    const normalized = data.choices[0].message.content.trim();
    
    return Response.json({ story: normalized }, { headers: cors() });
  } catch (e) {
    console.error('Normalize API error:', e);
    return new Response('Bad Request', { status: 400, headers: cors() });
  }
}


