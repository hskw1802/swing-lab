# 技術選定と設計

## 前提

- モバイルファーストのWebアプリ。PCでも同じ機能を使えること。
- 白ベースのLiquid Glass UI。宣伝用のキャッチコピーを置かず、操作・状態・結果を表示すること。
- 全画面スケルトンと十分なアニメーションを用意すること。
- 既存の動画解析、iPhone向け読み込み修正を保つこと。
- Cloudflareで配信すること。Workers AIは後続の指示で不採用。

## データフロー

```text
Cloudflare / Sites → HTML・CSS・アプリJS
MediaPipe配信元 → モデル・ライブラリ・WASM

ユーザーが動画を選択
  → ブラウザのBlob URLで読込
  → ミュート・インライン再生を準備
  → 0.5倍速で順に再生
  → デコードされたフレームを取得
  → 長辺960px以下のCanvasへ縮小
  → 端末内MediaPipeで姿勢座標を推定
  → 角度などを計算、元の動画へ描画
  → 計測値から参考コメントを作成
  → JSON / PNGとして端末へ保存
```

元動画や解析結果を保存するサーバーAPIは設けていません。Cloudflareは現状、アプリの配信を担います。D1・R2は未使用です。将来クラウド同期を追加する場合に、認証・保存範囲・保持期間を決めたうえでD1にメタデータ、R2にファイルを保存する構成が候補になります。現在の実装済み機能ではありません。

## フロントエンド

### HTML + JavaScript ES Modules

既存の処理とDOMを直接接続でき、動画・Canvasの制御をそのまま扱えます。画面数や状態の複雑さが限られているため、React、Vue、Next.jsなどは追加しませんでした。フレームワークそのものの初期化や依存管理を増やすより、iPhoneでの初期読込と動画処理に使える余力を優先しました。ES Modulesで解析処理、UI処理、アプリの接続を分けています。

### CSS + backdrop-filter

白い半透明背景、背景ぼかし、彩度補正、内側のハイライト、淡い影、丸みのある輪郭を組み合わせています。動画そのものの色や角度表示は残し、周辺の操作UIをガラス調にしています。`-webkit-backdrop-filter` を併記し、未対応環境には不透明に近い背景を用意します。[MDN: backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter)

### アニメーション

- CSS: スケルトンのシマー、読込中のスピナー、背景のゆらぎ、アップロードアイコンの浮遊
- CSS transitions: ボタン押下、ホバー、スイッチ、パネル、全画面ローダーの出入り
- Web Animations API: 解析結果の登場
- IntersectionObserver: スクロールに応じたパネル表示とナビゲーションの選択状態
- リップルとトースト: 操作の反応・保存完了の表示

GSAP、Framer Motion、Lottieなどは追加しませんでした。今回の動きはブラウザ標準機能で表現できるためです。システムの「視差効果を減らす」などに対応する `prefers-reduced-motion` を尊重し、動きを抑えます。[MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion)

全画面スケルトンは初期読込、動画準備、モデル準備、解析中に使用します。解析中も元のvideo要素はDOMに残して再生を継続します。背景の操作は `inert` で止め、ローディング内の中止操作を利用できます。表示を見せるためだけの最低待機時間は設けていません。

### SVG・システムフォント・Manifest

アイコンは小さなSVGスプライトを同梱し、外部アイコンフォントを不要にしました。フォントはOS標準のものを優先します。Web App Manifestは名前・テーマ色・アイコン・スタンドアロン表示情報を提供します。Service Workerはモデルや大きな動画のキャッシュ更新を別途設計する必要があるため、今回追加していません。

## 解析

### MediaPipe Pose Landmarker 0.10.21

ゴルフ専用の診断AIではなく、体のランドマーク抽出に使います。既存の検出処理を維持し、動画をサーバーへ送らずに座標を取得できます。JS/WASMと軽量モデルをバージョン固定の配信URLから取得します。最大長辺960pxの入力で推論し、オーバーレイは元のアスペクト比で描画します。[Google: Pose Landmarker Web](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js)

### 再生済みフレームの順次読取

初期版の「フレームごとにcurrentTimeを変更し、seekedを待つ」方式は廃止済みです。iPhoneで同じ位置へのseekや初回デコード待ちがタイムアウトする可能性を避け、再生されたフレームを順番に処理します。`requestVideoFrameCallback` のmediaTimeを使い、未対応環境ではrequestAnimationFrameとcurrentTimeを利用します。検出対象は最大12fpsを目安に間引きます。[MDN: requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)

再生開始はユーザーの操作直後にミュート・インライン再生で準備します。解析を中止、画面を非表示、動画の再生が停滞、再生の許可が得られないときは処理を終了して復帰可能なメッセージを出します。[WebKit: iOS video policies](https://webkit.org/blog/6784/new-video-policies-for-ios/)

### Canvas 2D・数値計算

WebGLの描画フレームワークを追加せずに、基準線・骨格・角度・軌跡を描画し、元動画と合成したPNGを保存できます。元動画の幅と高さを加味して2Dの角度を計算します。良い点・改善候補は、体軸の変動幅、正面撮影の頭の横移動などから作るルールベースの参考評価です。生成AIの出力ではありません。

## 保存と配信

### JSON / Blob / File API

姿勢座標、時刻、撮影方向、角度計算に必要な情報をJSONで保存します。ファイルを渡せば別端末で再表示できます。保存時に元動画は含めません。読込時は形式、バージョン、サイズ、時間、座標、信頼度を検証します。自動同期は実装していません。

### Cloudflare / Sites

現在の本番URLはSitesが管理するCloudflare環境で配信します。既存のサイトID、URL、非公開アクセス設定を維持します。クライアントで完結するため、独自API、データベース、常時稼働サーバーは追加していません。

別のCloudflareアカウントへ独立配信できるよう、Workers Static Assets用の `wrangler.jsonc` を同梱しています。これは現在のサイトと別のデプロイ経路です。[Cloudflare: Static Assets](https://developers.cloudflare.com/workers/static-assets/)

### Node.jsとGitHub Actions

Node.js標準のファイルAPIとHTTPサーバーでビルド・開発環境を用意しています。npmインストールは不要です。node:testで動画処理の回帰テストを実行します。GitHub ActionsではNode.js 22で構文検査・テスト・ビルドを行います。GitHub公開用のソースにSitesの認証情報や内部設定は含めません。本番への自動デプロイはCIとは別で、未設定です。

## 確認の範囲

回帰テストは、seekedが来ない動画、フレーム時刻、古いブラウザ向けの代替処理、中止、再生停滞、非表示化、再生拒否を扱います。ブラウザではスマホ幅、PC幅、動画入力、全画面スケルトン、結果ファイルの読込、レイヤー切替を確認します。iPhone実機と実際のゴルフ動画での診断精度の検証は別途必要です。
