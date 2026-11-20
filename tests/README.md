# ローカル確認（本番通信なし）

専用worktree C:/Users/kouse/stagelink-message-port-20261117 内で実行:

```powershell
node --test tests/search.test.cjs tests/messages.test.cjs
node tests/local-server.cjs
```

URL: http://127.0.0.1:4173/
別worktreeのサーバーが同じポートで起動中なら、自分で停止してから起動する。通常の静的サーバーやParticipant.htmlの直接表示は本番接続先を使うため避ける。

上部のA/B/Cボタンからログイン。メールはa@local.test等、パスワードはtest。データはローカルURLのlocalStorageのみ。

1. Aで「創像」「 entropy 」「大学B」を検索。大学/受付絞り込みを併用。
2. Aの会話一覧は最初Bのみ（B↔Cの履歴は取得されない）。Cの詳細→送信ボタンで新規会話を開く。送信前は一覧に増えず、成功後に最上部。
3. Bに送信するとBが上へ。「C → A 受信を追加」で約5秒後にCが上へ。未読数と既読化を確認。
4. Aのマイページで既存の承認・辞退を確認。理由入力は今回対象外。保存失敗時はステータスが変わらず、再試行できることを確認。
5. 未ログイン時の詳細→チャット→ログイン後復帰は通常のログインフォームで確認。http://127.0.0.1:4173/Participant.html?page=chat&with=b も試す。
6. 「初期データへ戻す」で繰り返し検証可能。

本番SDKを除去し、GAS/LINE URLを空にし、CSPで接続を禁止。モックのfetch/XHR等も通信しない実装。フィルタなしのmessages取得は拒否する。アイコンの外部CSSは読み込まないため一部アイコンが欠ける。
実通知・実RLSはモックでは検証できない。実ブラウザでの操作確認はまだ実施していない。公開前の作業はdocs/port-completion.mdを参照。
