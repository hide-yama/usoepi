'use client';

import { useEffect, useMemo, useState } from 'react';
import { Shuffle, UserPlus, ArrowLeft, Image as ImageIcon, Eye, Wand2, RefreshCcw, CheckCircle2, HelpCircle, X, Check, Lightbulb } from 'lucide-react';

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [storyRaw, setStoryRaw] = useState('');
  const [storyNorm, setStoryNorm] = useState('');
  const [choices, setChoices] = useState<Choice[]>([]);
  const [answerId, setAnswerId] = useState<'A' | 'B' | 'C' | null>(null);
  const [votes, setVotes] = useState<Record<string, 'A' | 'B' | 'C'>>({});
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // 写真アップ画面のステップ管理
  const [photoStep, setPhotoStep] = useState<'upload' | 'select' | 'write' | 'normalize' | 'generate' | 'complete'>('upload');

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

  // 画面遷移時にスクロール位置をリセット
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stage]);

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

  async function apiFakes(objects: DetectedObject[], trueStory: string, selectedObjectId: string | null) {
    if (mock) {
      await new Promise((r) => setTimeout(r, 500));
      return {
        fakes: [
          'サボテンを引っ越し祝いに友人から貰ったことがある。',
          'こないだ実家に帰った時に父のレコードプレイヤーを壊したけど、父にはまだ言ってない。',
        ],
      };
    }
    const r = await fetch(`${proxyBase || '/api'}/fakes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objects, true_story: trueStory, selected_object_id: selectedObjectId }),
    });
    if (!r.ok) throw new Error('fakes api error');
    return r.json();
  }

  // handlers
  async function handleFileChange(file: File | undefined | null) {
    if (!file) return;
    
    console.log('Processing image:', file.name, 'Size:', Math.round(file.size / 1024), 'KB');
    const dataUrl = await fileToDataURL(file);
    setPhotoDataUrl(dataUrl);
    setIsAnalyzing(true);
    
    try {
      console.log('Calling Vision API...');
      const { objects } = await apiVision(dataUrl);
      console.log('Vision API response:', objects);
      const parsed: DetectedObject[] = (objects || []).map((o: any, i: number) => ({ 
        id: o.id || `o${i+1}`, 
        label: o.label || '要素', 
        color: o.color || '', 
        pos: o.pos || '', 
        related: o.related || [] 
      }));
      setObjects(parsed);
      setSelectedObjectId(null);
      setPhotoStep('select'); // 次のステップに進む
    } catch (e) {
      alert('画像解析に失敗しました。再度お試しください。');
      console.error('Vision API error:', e);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleNormalize() {
    const raw = storyRaw.trim();
    if (!raw) return;
    try {
      const { story } = await apiNormalize(raw);
      setStoryNorm(story || raw);
      setPhotoStep('normalize'); // 次のステップに進む
    } catch (e) {
      alert('整形に失敗しました。');
    }
  }

  async function handleGenerate() {
    const norm = (storyNorm || '').trim();
    if (!norm) return;
    try {
      const { fakes } = await apiFakes(objects, norm, selectedObjectId);
      const trueChoice: Choice = { id: 'A', text: norm, isTrue: true };
      const others: Choice[] = [
        { id: 'B', text: fakes?.[0] || 'フェイク1', isTrue: false },
        { id: 'C', text: fakes?.[1] || 'フェイク2', isTrue: false },
      ];
      const mixed = shuffle([trueChoice, ...others]).map((c, i) => ({ ...c, id: (['A','B','C'][i] as Choice['id']) }));
      setChoices(mixed);
      setAnswerId(mixed.find((c) => c.isTrue)!.id);
      setVotes({});
      setPhotoStep('complete'); // ステップ完了
      setStage('quiz');
      window.scrollTo(0, 0);
    } catch (e) {
      alert('フェイク生成に失敗しました。');
      console.error(e);
    }
  }

  function reveal() {
    setStage('result');
    window.scrollTo(0, 0);
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
    setPhotoStep('upload');
  }

  const correctNames = useMemo(() => players.filter((n) => n !== presenter && votes[n] === answerId), [players, presenter, votes, answerId]);
  const votingPlayers = useMemo(() => players.filter(n => n !== presenter), [players, presenter]);
  const incorrectNames = useMemo(() => votingPlayers.filter(n => !correctNames.includes(n)), [votingPlayers, correctNames]);

  // ローディングスピナーコンポーネント
  function LoadingOverlay() {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-[var(--panel)] rounded-2xl p-8 border border-[var(--border)] flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--gold)] border-t-transparent rounded-full rainbow-spinner" />
          <p className="text-lg font-medium">画像を解析中...</p>
        </div>
      </div>
    );
  }

  // プログレスインジケーターコンポーネント
  function ProgressIndicator() {
    const steps = [
      { key: 'upload', label: '写真選択', completed: !!photoDataUrl },
      { key: 'select', label: '要素選択', completed: !!selectedObjectId },
      { key: 'write', label: '実話入力', completed: storyRaw.trim().length > 0 },
      { key: 'normalize', label: '文章確認', completed: !!storyNorm },
      { key: 'generate', label: '完成', completed: choices.length > 0 }
    ];

    return (
      <div className="mb-6 bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.key} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                step.completed 
                  ? 'bg-[var(--green)] border-[var(--green)] text-white' 
                  : photoStep === step.key 
                    ? 'border-[var(--blue)] text-[var(--blue)] pulse-active' 
                    : 'border-[var(--muted)] text-[var(--muted)]'
              }`}>
                {step.completed ? (
                  <Check className="w-4 h-4 check-animation" />
                ) : (
                  <span className="text-xs font-bold">{index + 1}</span>
                )}
              </div>
              <span className={`ml-2 text-sm hidden sm:inline ${
                step.completed 
                  ? 'text-[var(--green)]' 
                  : photoStep === step.key 
                    ? 'text-[var(--blue)] font-bold' 
                    : 'text-[var(--muted)]'
              }`}>
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div className={`w-8 h-0.5 mx-2 ${
                  step.completed ? 'bg-[var(--green)]' : 'bg-[var(--muted)]'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // フローティングヘルプチップコンポーネント
  function FloatingTip() {
    const getTipMessage = () => {
      switch(photoStep) {
        case 'upload':
          return '写真をアップロードしてください';
        case 'select':
          return '写真から要素を1つ選んでください';
        case 'write':
          return '選んだ要素について実話を書いてください';
        case 'normalize':
          return '文章を確認して、必要なら編集してください';
        case 'generate':
          return 'フェイク2本を生成してゲームを開始しましょう';
        default:
          return '';
      }
    };

    const message = getTipMessage();
    if (!message) return null;

    return (
      <div className="fixed bottom-6 right-6 z-30 floating-tip pointer-events-none">
        <div className="bg-[var(--blue)] text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          <span className="text-sm font-medium">{message}</span>
        </div>
      </div>
    );
  }

  // ヘルプモーダルコンポーネント
  function HelpModal() {
    if (!showHelpModal) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowHelpModal(false)}>
        <div className="bg-[var(--panel)] rounded-2xl p-6 border border-[var(--border)] max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">使い方</h2>
            <button className="btn p-2" onClick={() => setShowHelpModal(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-bold text-[var(--gold)] mb-2">🎮 ゲームの流れ</h3>
              <ol className="list-decimal list-inside space-y-2 text-[var(--muted)]">
                <li>2〜8名のプレイヤーを登録</li>
                <li>各ラウンドで出題者を1名選択</li>
                <li>出題者は写真をアップロードし、写真内の要素を1つ選んで実話を入力</li>
                <li>AIが選ばれなかった要素を使って、巧妙なウソエピソードを2つ生成</li>
                <li>他のプレイヤーは3つのエピソードから本物を当てる</li>
              </ol>
            </section>
            
            <section>
              <h3 className="font-bold text-[var(--red)] mb-2">📸 写真のコツ</h3>
              <ul className="list-disc list-inside space-y-1 text-[var(--muted)]">
                <li>複数の要素が含まれる写真がおすすめ</li>
                <li>思い出深い場所や物の写真だと面白い実話が作りやすい</li>
                <li>画像サイズの制限はありません</li>
              </ul>
            </section>
            
            <section>
              <h3 className="font-bold text-[var(--blue)] mb-2">✍️ 実話の書き方</h3>
              <ul className="list-disc list-inside space-y-1 text-[var(--muted)]">
                <li>選んだ要素にまつわる個人的な思い出を書く</li>
                <li>20〜40字程度の短い文章に整形されます</li>
                <li>「〜だった」「〜していた」など過去形で書くと自然</li>
              </ul>
            </section>
            
            <section>
              <h3 className="font-bold text-[var(--green)] mb-2">🏆 勝利条件</h3>
              <ul className="list-disc list-inside space-y-1 text-[var(--muted)]">
                <li><strong>回答者</strong>：本物のエピソードを見抜く</li>
                <li><strong>出題者</strong>：全員を騙すことができれば名演技！</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {isAnalyzing && <LoadingOverlay />}
      {<HelpModal />}
      {stage === 'photo' && <FloatingTip />}
      <header className="sticky top-0 z-10 backdrop-blur bg-[rgba(11,12,16,0.55)] border-b border-[var(--border)]">
        <div className="max-w-[980px] mx-auto p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1" />
            <div className="text-center">
              <div className="font-bold text-2xl tracking-wide mb-1">
                <span style={{ color: '#FFD700' }}>U</span>
                <span style={{ color: '#FF4757' }}>S</span>
                <span style={{ color: '#4169E1' }}>O</span>
                <span style={{ color: '#32CD32' }}>E</span>
                <span style={{ color: '#FFD700' }}>P</span>
                <span style={{ color: '#FF4757' }}>I</span>
              </div>
              <div className="text-sm text-[var(--muted)]">ウソエピ</div>
            </div>
            <div className="flex-1 flex justify-end">
              <button className="btn p-2" onClick={() => setShowHelpModal(true)} title="使い方">
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[980px] mx-auto p-5 space-y-5">
        {/* Setup */}
        <section className={`panel ${stage==='setup' ? '' : 'hidden'}`}>
          <h3 className="text-lg font-semibold mb-1"><span style={{ color: '#FFD700' }}>1)</span> プレイヤー登録</h3>
          <p className="text-sm text-[var(--muted)]">2〜8名まで。表示名のみ（重複不可）。</p>
          <div className="flex flex-wrap gap-3 mt-2">
            {players.map((name, idx) => (
              <div key={idx} className="panel flex-1 min-w-[300px] p-3">
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
            <button className="btn btn-gold" onClick={()=>{
              if (players.length >= 8) { alert('プレイヤーは最大8名までです。'); return; }
              setPlayers([...players, '']);
            }}><UserPlus className="w-4 h-4 mr-1"/>プレイヤー追加</button>
            <button className="btn btn-success" disabled={!canStart} onClick={()=>{ setStage('presenter'); window.scrollTo(0, 0); }}>開始</button>
          </div>
        </section>

        {/* Presenter */}
        <section className={`panel ${stage==='presenter' ? '' : 'hidden'}`}>
          <h3 className="text-lg font-semibold mb-2"><span style={{ color: '#FF4757' }}>2)</span> 出題者を選んでください</h3>
          <div className="flex flex-wrap gap-2 mt-1">
            {players.map((name)=> (
              <button key={name} className="btn" onClick={()=>{ setPresenter(name); setStage('photo'); window.scrollTo(0, 0); }}>{name}</button>
            ))}
          </div>
          <div className="flex justify-end mt-3">
            <button className="btn" onClick={()=>{ setStage('setup'); window.scrollTo(0, 0); }}><ArrowLeft className="w-4 h-4 mr-1"/>戻る</button>
          </div>
        </section>

        {/* Photo & Story */}
        <section className={`panel ${stage==='photo' ? '' : 'hidden'}`}>
          {/* 出題者表示 */}
          <div className="mb-4 p-3 bg-[var(--blue)]/10 border border-[var(--blue)]/30 rounded-xl text-center">
            <p className="text-lg font-semibold">出題者: <span style={{ color: '#4169E1' }}>{presenter}</span>さん</p>
          </div>
          
          {/* プログレスインジケーター */}
          <ProgressIndicator />
          
          <h3 className="text-lg font-semibold mb-3"><span style={{ color: '#4169E1' }}>3)</span> 写真をアップし、対象と実話を入力</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">写真ファイル</label>
              <input type="file" accept="image/*" onChange={(e)=>handleFileChange(e.currentTarget.files?.[0])} />
              {photoDataUrl && (
                <img src={photoDataUrl} alt="preview" className="photo-preview mt-2"/>
              )}
              {objects.length > 0 && (
                <div className="mt-3">
                  <label className="block text-xs text-[var(--muted)] mb-1">検出された要素（選択してください）</label>
                  <div>
                    {objects.map((o)=> (
                      <span key={o.id} className={`chip ${selectedObjectId===o.id ? 'sel':''}`} onClick={()=>{setSelectedObjectId(o.id); if(o.id) setPhotoStep('write');}}>
                        {o.label}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-1">※ 選択した要素で実話を作成、残りの要素でフェイクを生成します</p>
                </div>
              )}
            </div>
            {selectedObjectId && (
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">実話エピソード（簡潔に）</label>
                <textarea 
                  value={storyRaw} 
                  onChange={(e)=>{
                    setStoryRaw(e.target.value);
                    if(e.target.value.trim().length > 0 && photoStep === 'write') {
                      // まだ入力段階のままなので、十分な文章になったらnormalizeステップに案内
                    }
                  }} 
                  maxLength={100} 
                  placeholder="例：大学時代に毎日使っていた赤いマグカップ" 
                  className="w-full rounded-xl border bg-[#0f1218] border-[var(--border)] p-2 text-sm min-h-[80px] pulse-active"/>
                <div className="mt-2 flex items-center gap-2">
                  <button 
                    className={`btn ${storyRaw.trim().length === 0 ? 'btn-disabled' : 'pulse-active'}`} 
                    disabled={!canNormalize} 
                    onClick={handleNormalize}
                  >
                    <Wand2 className="w-4 h-4 mr-1"/>
                    {storyRaw.trim().length === 0 ? '実話を入力してください' : '整形する ✨'}
                  </button>
                </div>
                {storyNorm && (
                  <div className="mt-3">
                    <label className="block text-xs text-[var(--muted)] mb-1">整形後（必要なら編集可）</label>
                    <textarea value={storyNorm} onChange={(e)=>setStoryNorm(e.target.value)} className="w-full rounded-xl border bg-[#0f1218] border-[var(--border)] p-2 text-sm min-h-[110px]"/>
                    <div className="flex justify-end mt-2">
                      <button className="btn btn-primary pulse-active" onClick={handleGenerate}>
                        <Shuffle className="w-4 h-4 mr-1"/>
                        フェイク2本を生成してゲーム開始 🎮
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* 戻るボタン */}
          <div className="flex justify-end mt-4">
            <button className="btn" onClick={()=>{ setPresenter(null); setStage('presenter'); window.scrollTo(0, 0); }}>
              <ArrowLeft className="w-4 h-4 mr-1"/>出題者選択に戻る
            </button>
          </div>
        </section>

        {/* Quiz */}
        <section className={`panel ${stage==='quiz' ? '' : 'hidden'}`}>
          <h3 className="text-lg font-semibold mb-3"><span style={{ color: '#32CD32' }}>4)</span> 三択クイズ</h3>
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
            {players.filter(name => name !== presenter).map((name)=> (
              <li key={name} className="flex items-center justify-between gap-2 py-2 border-b border-dashed border-[var(--border)]">
                <div>{name}</div>
                <div className="inline-grid grid-cols-3 gap-1 vote-buttons">
                  {(['A','B','C'] as const).map((id)=> (
                    <button key={id} className={`rounded-lg border px-0 py-2 w-10 transition-all ${votes[name]===id ? 'sel':''}`} onClick={()=>setVotes((v)=>({ ...v, [name]: id }))}>{id}</button>
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
          {/* 正解表示 */}
          <div className="mb-4 p-4 bg-[var(--accent-2)]/10 border border-[var(--accent-2)]/30 rounded-xl text-center">
            <p className="text-lg font-bold text-[var(--accent-2)]">
              正解は{answerId}の「{choices.find(c => c.id === answerId)?.text}」でした
            </p>
          </div>
          
          {/* 結果サマリー */}
          <div className="mb-6 p-4 bg-[var(--card)] rounded-xl border border-[var(--border)]">
            <div className="text-center mb-4">
              <h4 className="text-xl font-bold mb-2">結果発表</h4>
              <p className="text-lg">{correctNames.length} / {votingPlayers.length}人が正解！</p>
            </div>
            
            {correctNames.length > 0 && (
              <div className="mb-3">
                <h5 className="text-lg font-semibold text-[var(--accent-2)] mb-2">✅ 正解</h5>
                <div className="space-y-2">
                  {correctNames.map(name => (
                    <div key={name} className="bg-[var(--accent-2)]/20 border border-[var(--accent-2)]/30 rounded-xl p-3">
                      <div className="text-[var(--accent-2)] font-bold text-lg">{name}さんすごい！おめでとう！！🎉</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {correctNames.length === 0 && (
              <div className="mb-3">
                <div className="bg-[var(--gold)]/20 border border-[var(--gold)]/30 rounded-xl p-4 text-center">
                  <div className="text-[var(--gold)] font-bold text-lg">{presenter}さんさすがです。名演技！🎭✨</div>
                </div>
              </div>
            )}
            
            {incorrectNames.length > 0 && correctNames.length > 0 && (
              <div>
                <h5 className="text-lg font-semibold text-[var(--red)] mb-2">❌ 不正解</h5>
                <div className="space-y-2">
                  {incorrectNames.map(name => (
                    <div key={name} className="bg-[var(--red)]/10 border border-[var(--red)]/20 rounded-xl p-3">
                      <div className="text-[var(--red)] font-medium">{name}さん今日もあなたの目はフシアナです💩</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {choices.map((c)=> (
              <div key={c.id} className={`card ${c.id===answerId ? 'border-[var(--accent-2)] ring-2 ring-[rgba(122,219,180,0.25)]':''}`}>
                <h4 className="text-xs text-[var(--muted)] m-0 flex items-center gap-1">{c.id} {c.id===answerId && <CheckCircle2 className="w-4 h-4 text-[var(--accent-2)]"/>}</h4>
                <p className="m-0 leading-6 text-sm" dangerouslySetInnerHTML={{__html: escapeHtml(c.text)}}/>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button className="btn" onClick={()=>{ resetRound(); setStage('presenter'); window.scrollTo(0, 0); }}><RefreshCcw className="w-4 h-4 mr-1"/>次のラウンドへ</button>
            <button className="btn" onClick={()=>{ resetRound(); setStage('photo'); window.scrollTo(0, 0); }}>このラウンドをやり直す</button>
          </div>
        </section>
      </main>
    </div>
  );
}


