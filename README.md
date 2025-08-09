# フォト三択：ほんとかフェイクか

写真と短い実話からAIが実話1つ＋フェイク2つの三択を生成するクイズアプリです。

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local`ファイルを作成し、OpenAI APIキーを設定してください：

```bash
# .env.localファイルをコピー
cp .env.local.example .env.local

# .env.localを編集してAPIキーを設定
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

APIキーは[OpenAI Platform](https://platform.openai.com/api-keys)から取得できます。

### 3. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアプリケーションが起動します。

## 機能

- **プレイヤー登録**：2〜8名まで登録可能
- **写真アップロード**：画像から物体を自動検出（OpenAI Vision API）
- **実話入力**：選んだ物体に関する実話を120-160字に整形
- **フェイク生成**：写真内の別要素を使って紛らわしいフェイク2本を生成
- **三択投票**：参加者全員が投票
- **結果発表**：正解者数と名前を表示

## 技術スタック

- Next.js 15.3.3
- React 19
- TypeScript
- Tailwind CSS
- OpenAI API (GPT-4o-mini)

## 注意事項

- APIキーなしの場合はモック動作します
- 画像は5MBまで対応
- データは端末内のみ保存（sessionStorage）