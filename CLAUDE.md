# USOEPI ウソエピ - 開発ドキュメント

## プロジェクト概要

USO（嘘）とEPISODE（エピソード）を組み合わせた写真クイズアプリ。ユーザーが写真をアップロードし、写真内の要素について実話を作成すると、AIが同じ写真の別要素を使って紛らわしいフェイク2つを生成し、三択クイズを作成する。

## 開発経緯と技術判断

### AI モデル選択
- **Vision API**: `gpt-4o-mini` - コスト効率重視で画像解析に十分な精度
- **テキスト生成**: `gpt-4o` - より自然で品質の高いフェイク生成のため
- **当初は gpt-5-mini を試行したが、2025年1月時点でAPI未提供のため断念**

### アーキテクチャ決定
- **Next.js 15 App Router**: 最新機能とEdge Runtimeを活用
- **Edge Runtime**: 全APIルートで採用、レスポンス高速化
- **sessionStorage**: サーバー不要でローカル完結、シンプルな状態管理

### 重複防止システムの実装
**問題**: ユーザーの実話とAI生成のフェイクが同じ要素を扱って区別困難
**解決策**: 
1. 物理的分離 - 選択された要素をフェイク生成から除外
2. 選択必須UI - ユーザーは検出要素から必ず1つ選択
3. 単一要素フォーカス - 1つのフェイクには1つの要素のみ使用

### プロンプト最適化の変遷
1. **初期**: 汎用的な物体検出
2. **色情報除去**: UI簡略化のため色情報を不要に変更
3. **重複タグ防止**: 同種物体の複数検出を1つにまとめる制約追加
4. **体験文統一**: 過去の体験として自然な文体に統一

## 主要実装パターン

### 非同期処理とローディング状態
```typescript
const [isAnalyzing, setIsAnalyzing] = useState(false);

// 画像解析中は全UI操作をブロック
{isAnalyzing && <LoadingOverlay />}
<textarea disabled={isAnalyzing || objects.length === 0} />
```

### 状態管理パターン
```typescript
// セッション復元
useEffect(() => {
  const s = JSON.parse(sessionStorage.getItem('pq_state_v1') || '{}');
  if (Array.isArray(s.players)) setPlayers(s.players);
}, []);

// 自動保存
useEffect(() => {
  sessionStorage.setItem('pq_state_v1', JSON.stringify({ players, presenter }));
}, [players, presenter]);
```

### 結果表示のパーソナライゼーション
```typescript
const correctNames = useMemo(() => 
  players.filter((n) => n !== presenter && votes[n] === answerId), 
  [players, presenter, votes, answerId]
);

// 正解者へのお祝い
{correctNames.map(name => (
  <div>{name}さんすごい！おめでとう！！🎉</div>
))}

// 全員不正解時は出題者を称賛
{correctNames.length === 0 && (
  <div>{presenter}さんさすがです。名演技！🎭✨</div>
)}
```

## API設計思想

### `/api/vision` - 画像解析
- 重複除去ロジック内蔵
- JSONパース失敗時の graceful degradation
- モック応答による開発時の利便性

### `/api/normalize` - 実話整形
- 一定文字数への正規化（20-40字）
- 過去体験文への統一（「〜していた」「〜だった」）
- 個人情報の一般化

### `/api/fakes` - フェイク生成
- 選択要素の物理的除外による重複防止
- 番号付きレスポンスのパース処理
- フォールバック機能付きエラーハンドリング

## UI/UX配慮事項

### ユーザビリティ
- 画像解析中の操作ブロック（誤操作防止）
- 要素選択の必須化（重複防止のため）
- 段階的な情報開示（ステップごとのUI表示）

### フィードバック設計
- 正解者への具体的な祝福メッセージ
- 不正解者への軽い煽り文句
- 出題者への演技力称賛

### レスポンシブ対応
- グリッドレイアウトでデスクトップ・モバイル両対応
- タッチデバイスでの操作性を考慮したボタンサイズ

## 技術的制約と対処

### OpenAI API制約
- Vision APIの画像サイズ制限: 5MB以下に制限
- レスポンス形式の不安定性: JSONパース失敗時の代替処理
- レート制限: エラーハンドリングと再試行なし（ユーザー判断に委ねる）

### パフォーマンス最適化
- Edge Runtimeによる高速レスポンス
- 必要最小限の状態管理
- 画像データのメモリ効率化（DataURL使用）

## 今後の拡張可能性

### 機能拡張
- 複数ラウンド対応のスコア管理
- カテゴリ別の物体検出（食べ物、動物など）
- 難易度調整機能

### 技術的改善
- WebSocketによるリアルタイム投票
- 画像前処理による検出精度向上
- AI生成文の自然さ評価機能

## 開発者向けTips

### デバッグ方法
```typescript
// Vision APIレスポンスの確認
console.log('OpenAI Vision response:', content);

// パースされたオブジェクトの確認  
console.log('Parsed objects:', objects);
```

### 環境設定
- `.env.local.example` をコピーして `.env.local` を作成
- OpenAI APIキーの設定必須（なしでもモック動作可能）

### 動作確認
1. 複数人でのテスト（最低3名推奨）
2. 様々な写真での物体検出テスト
3. 重複回避の動作確認（同じ物体が複数ある写真で）