'use client';

import { useEffect, useMemo, useState } from 'react';
import { Shuffle, UserPlus, ArrowLeft, Image as ImageIcon, Eye, Wand2, RefreshCcw, CheckCircle2 } from 'lucide-react';

type Choice = { id: 'A' | 'B' | 'C'; text: string; isTrue: boolean };
type DetectedObject = { id: string; label: string; color?: string; pos?: string; related?: string[] };

type Stage = 'setup' | 'presenter' | 'photo' | 'quiz' | 'result';

export default function Page() {
  const [players, setPlayers] = useState<string[]>([]);
  const [presenter, setPresenter] = useState<string | null>(null);
  const [proxyBase, setProxyBase] = useState<string>('');
  const [mock, setMock] = useState<boolean>(false);
  const [stage, setStage] = useState<Stage>('setup');

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [storyRaw, setStoryRaw] = useState('');
  const [storyNorm, setStoryNorm] = useState('');
  const [choices, setChoices] = useState<Choice[]>([]);
  const [answerId, setAnswerId] = useState<'A' | 'B' | 'C' | null>(null);
  const [votes, setVotes] = useState<Record<string, 'A' | 'B' | 'C'>>({});

  // session restore (players/presenter/proxy/mock)
  useEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem('pq_state_v1') || '{}');
      if (Array.isArray(s.players)) setPlayers(s.players);
      if (s.presenter) setPresenter(s.presenter);
      if (typeof s.proxyBase === 'string') setProxyBase(s.proxyBase);
      if (typeof s.mock === 'boolean') setMock(s.mock);
    } catch {}
  }, []);

  useEffect(() => {
    sessionStorage.setItem(
      'pq_state_v1',
      JSON.stringify({ players, presenter, proxyBase, mock })
    );
  }, [players, presenter, proxyBase, mock]);

  const canStart = useMemo(() => {
    const trimmed = players.map((p) => p.trim()).filter(Boolean);
    return (
      trimmed.length >= 2 &&
      new Set(trimmed).size === trimmed.length &&
      !players.some((p) => !p.trim())
    );
  }, [players]);

  const canNormalize = useMemo(() => {
    return !!photoDataUrl && objects.length > 0 && !!selectedObjectId && storyRaw.trim().length > 0;
  }, [photoDataUrl, objects, selectedObjectId, storyRaw]);

  // helpers
  const shuffle = <T,>(arr: T[]): T[] => arr.map(v => [Math.random(), v] as const).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);
  const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'} as any)[c]);

  async function fileToDataURL(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // API wrappers
  async function apiVision(base64: string) {
    if (mock) {
      await new Promise((r) => setTimeout(r, 400));
      return {
        objects: [
          { id: 'o1', label: '赤いマグカップ', color: '赤', pos: '左前', related: ['テーブル'] },
          { id: 'o2', label: 'サボテン', color: '緑', pos: '右奥', related: ['窓'] },
          { id: 'o3', label: 'レコードプレーヤー', color: '黒', pos: '中央', related: ['棚'] },
        ],
      };
    }
    const r = await fetch(`${proxyBase || '/api'}/vision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64 }),
    });
    if (!r.ok) throw new Error('vision api error');
    return r.json();
  }

  async function apiNormalize(story: string) {
    if (mock) {
      await new Promise((r) => setTimeout(r, 300));
      return { story: story.slice(0, 160) + (story.length > 160 ? '…' : '') };
    }
    const r = await fetch(`${proxyBase || '/api'}/normalize`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story }),
    });
    if (!r.ok) throw new Error('normalize api error');
    return r.json();
  }

  async function apiFakes(objects: DetectedObject[], trueStory: string) {
    if (mock) {
      await new Promise((r) => setTimeout(r, 500));
      return {
        fakes: [
          '窓辺のサボテンは引っ越し初日に友人から。朝の光で針がきらめくのを見ると落ち着く。',
          '父から譲り受けたプレーヤーはゆっくり回転音がして、湿った夏の風まで思い出させる。',
        ],
      };
    }
    const r = await fetch(`${proxyBase || '/api'}/fakes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objects, true_story: trueStory }),
    });
    if (!r.ok) throw new Error('fakes api error');
    return r.json();
  }

  // handlers
  async function handleFileChange(file: File | undefined | null) {
    if (!file) return;
    const dataUrl = await fileToDataURL(file);
    setPhotoDataUrl(dataUrl);
    try {
      const { objects } = await apiVision(dataUrl);
      const parsed: DetectedObject[] = (objects || []).map((o: any, i: number) => ({ id: o.id || `o${i+1}`, label: o.label || '要素', color: o.color || '', pos: o.pos || '', related: o.related || [] }));
      setObjects(parsed);
      setSelectedObjectId(null);
    } catch (e) {
      alert('画像解析に失敗しました。再度お試しください。');
      console.error(e);
    }
  }

  async function handleNormalize() {
    const raw = storyRaw.trim();
    if (!raw) return;
    try {
      const { story } = await apiNormalize(raw);
      setStoryNorm(story || raw);
    } catch (e) {
      alert('整形に失敗しました。');
    }
  }

  async function handleGenerate() {
    const norm = (storyNorm || '').trim();
    if (!norm) return;
    try {
      const { fakes } = await apiFakes(objects, norm);
      const trueChoice: Choice = { id: 'A', text: norm, isTrue: true };
      const others: Choice[] = [
        { id: 'B', text: fakes?.[0] || 'フェイク1', isTrue: false },
        { id: 'C', text: fakes?.[1] || 'フェイク2', isTrue: false },
      ];
      const mixed = shuffle([trueChoice, ...others]).map((c, i) => ({ ...c, id: (['A','B','C'][i] as Choice['id']) }));
      setChoices(mixed);
      setAnswerId(mixed.find((c) => c.isTrue)!.id);
      setVotes({});
      setStage('quiz');
    } catch (e) {
      alert('フェイク生成に失敗しました。');
      console.error(e);
    }
  }

  function reveal() {
    setStage('result');
  }

  function resetRound(keepPhoto = false) {
    setPhotoDataUrl((p) => (keepPhoto ? p : null));
    setObjects([]);
    setSelectedObjectId(null);
    setStoryRaw('');
    setStoryNorm('');
    setChoices([]);
    setAnswerId(null);
    setVotes({});
  }

  const correctNames = useMemo(() => players.filter((n) => votes[n] === answerId), [players, votes, answerId]);

  return (
    <div>
      <header className="sticky top-0 z-10 backdrop-blur bg-[rgba(11,12,16,0.55)] border-b border-[var(--border)]">
        <div className="max-w-[980px] mx-auto p-4 flex items-center justify-between">
          <div>
            <div className="font-bold tracking-wide">フォト三択：ほんとかフェイクか</div>
            <div className="text-xs text-[var(--muted)]">Next.js + API（MVP）</div>
          </div>
          <div className="text-xs text-[var(--muted)]">データは端末内のみ／スコア保存なし</div>
        </div>
      </header>

      <main className="max-w-[980px] mx-auto p-5 space-y-5">
        {/* Setup */}
        <section className={`panel ${stage==='setup' ? '' : 'hidden'}`}>
          <h3 className="text-lg font-semibold mb-1">1) プレイヤー登録</h3>
          <p className="text-sm text-[var(--muted)]">2〜8名まで。表示名のみ（重複不可）。</p>
          <div className="flex flex-wrap gap-3 mt-2">
            {players.map((name, idx) => (
              <div key={idx} className="panel flex-1 min-w-[260px] p-3">
                <label className="block text-xs text-[var(--muted)] mb-1">プレイヤー{idx+1}</label>
                <div className="flex items-center gap-2">
                  <input
                    className="w-full rounded-xl border bg-[#0f1218] border-[var(--border)] px-3 py-2 text-sm"
                    placeholder="表示名"
                    value={name}
                    onChange={(e)=>{
                      const next=[...players]; next[idx]=e.target.value; setPlayers(next);
                    }}
                  />
                  <button className="btn btn-danger" onClick={()=>{
                    const next = players.slice(); next.splice(idx,1); setPlayers(next);
                  }}>削除</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn" onClick={()=>{
              if (players.length >= 8) { alert('プレイヤーは最大8名までです。'); return; }
              setPlayers([...players, '']);
            }}><UserPlus className="w-4 h-4 mr-1"/>プレイヤー追加</button>
            <button className="btn btn-primary" disabled={!canStart} onClick={()=>setStage('presenter')}>開始</button>
          </div>
          <div className="border-t border-[var(--border)] my-3"/>
          <details>
            <summary className="text-[var(--muted)] text-sm cursor-pointer">接続設定（必要な方のみ）</summary>
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">APIプロキシベースURL <span className="text-[10px]">例: /api または https://example.com/api</span></label>
                <input className="w-full rounded-xl border bg-[#0f1218] border-[var(--border)] px-3 py-2 text-sm" value={proxyBase} onChange={(e)=>setProxyBase(e.target.value.trim())} placeholder="/api"/>
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">モックモード</label>
                <button className="btn" onClick={()=>setMock(v=>!v)}>{mock ? 'ON' : 'OFF'}</button>
                <div className="text-[10px] text-[var(--muted)]">※モックはUI確認用。実生成はプロキシが必要です。</div>
              </div>
            </div>
          </details>
        </section>

        {/* Presenter */}
        <section className={`panel ${stage==='presenter' ? '' : 'hidden'}`}>
          <h3 className="text-lg font-semibold mb-2">2) 出題者を選んでください</h3>
          <div className="flex flex-wrap gap-2 mt-1">
            {players.map((name)=> (
              <button key={name} className="btn" onClick={()=>{ setPresenter(name); setStage('photo'); }}>{name}</button>
            ))}
          </div>
          <div className="flex justify-end mt-3">
            <button className="btn" onClick={()=>setStage('setup')}><ArrowLeft className="w-4 h-4 mr-1"/>戻る</button>
          </div>
        </section>

        {/* Photo & Story */}
        <section className={`panel ${stage==='photo' ? '' : 'hidden'}`}>
          <h3 className="text-lg font-semibold mb-3">3) 写真をアップし、対象と実話を入力</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">写真ファイル</label>
              <input type="file" accept="image/*" onChange={(e)=>handleFileChange(e.currentTarget.files?.[0])} />
              {photoDataUrl && (
                <img src={photoDataUrl} alt="preview" className="photo-preview mt-2"/>
              )}
              {objects.length > 0 && (
                <div className="mt-3">
                  <label className="block text-xs text-[var(--muted)] mb-1">抽出された要素（選択してください）</label>
                  <div>
                    {objects.map((o)=> (
                      <span key={o.id} className={`chip ${selectedObjectId===o.id ? 'sel':''}`} onClick={()=>setSelectedObjectId(o.id)}>
                        {o.label}{o.color ? ` / ${o.color}`:''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">実話エピソード（〜200字）</label>
              <textarea value={storyRaw} onChange={(e)=>setStoryRaw(e.target.value)} maxLength={220} placeholder="例：大学の冬、赤いマグでインスタントをよく飲んで…" className="w-full rounded-xl border bg-[#0f1218] border-[var(--border)] p-2 text-sm min-h-[110px]"/>
              <div className="mt-2 flex items-center gap-2">
                <button className="btn" disabled={!canNormalize} onClick={handleNormalize}><Wand2 className="w-4 h-4 mr-1"/>整形する</button>
              </div>
              {storyNorm && (
                <div className="mt-3">
                  <label className="block text-xs text-[var(--muted)] mb-1">整形後（必要なら編集可）</label>
                  <textarea value={storyNorm} onChange={(e)=>setStoryNorm(e.target.value)} className="w-full rounded-xl border bg-[#0f1218] border-[var(--border)] p-2 text-sm min-h-[110px]"/>
                  <div className="flex justify-end mt-2">
                    <button className="btn btn-primary" onClick={handleGenerate}><Shuffle className="w-4 h-4 mr-1"/>フェイク2本を生成</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Quiz */}
        <section className={`panel ${stage==='quiz' ? '' : 'hidden'}`}>
          <h3 className="text-lg font-semibold mb-3">4) 三択クイズ</h3>
          {photoDataUrl && (
            <div className="mb-3">
              <img src={photoDataUrl} alt="preview" className="photo-preview"/>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {choices.map((c)=> (
              <div key={c.id} className={`card`}>
                <h4 className="text-xs text-[var(--muted)] m-0">{c.id}</h4>
                <p className="m-0 leading-6 text-sm" dangerouslySetInnerHTML={{__html: escapeHtml(c.text)}}/>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--border)] my-3"/>
          <h4 className="text-sm text-[var(--muted)]">投票</h4>
          <ul className="list-none p-0 m-0">
            {players.map((name)=> (
              <li key={name} className="flex items-center justify-between gap-2 py-2 border-b border-dashed border-[var(--border)]">
                <div>{name}</div>
                <div className="inline-grid grid-cols-3 gap-1 vote-buttons">
                  {(['A','B','C'] as const).map((id)=> (
                    <button key={id} className={`rounded-lg border px-0 py-2 w-10 ${votes[name]===id ? 'sel':''}`} onClick={()=>setVotes((v)=>({ ...v, [name]: id }))}>{id}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          <div className="flex justify-end mt-3">
            <button className="btn" disabled={Object.keys(votes).length===0} onClick={reveal}><Eye className="w-4 h-4 mr-1"/>正解を表示</button>
          </div>
        </section>

        {/* Result */}
        <section className={`panel ${stage==='result' ? '' : 'hidden'}`}>
          <h3 className="text-lg font-semibold mb-3">5) 結果</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {choices.map((c)=> (
              <div key={c.id} className={`card ${c.id===answerId ? 'border-[var(--accent-2)] ring-2 ring-[rgba(122,219,180,0.25)]':''}`}>
                <h4 className="text-xs text-[var(--muted)] m-0 flex items-center gap-1">{c.id} {c.id===answerId && <CheckCircle2 className="w-4 h-4 text-[var(--accent-2)]"/>}</h4>
                <p className="m-0 leading-6 text-sm" dangerouslySetInnerHTML={{__html: escapeHtml(c.text)}}/>
              </div>
            ))}
          </div>
          <p className="text-[var(--muted)] mt-2 text-sm">{`${correctNames.length} / ${players.length}人 正解：${correctNames.join(', ') || '—'}`}</p>
          <div className="flex justify-end gap-2 mt-2">
            <button className="btn" onClick={()=>{ resetRound(); setStage('presenter'); }}><RefreshCcw className="w-4 h-4 mr-1"/>次のラウンドへ</button>
            <button className="btn" onClick={()=>{ resetRound(); setStage('photo'); }}>このラウンドをやり直す</button>
          </div>
        </section>
      </main>
    </div>
  );
}


