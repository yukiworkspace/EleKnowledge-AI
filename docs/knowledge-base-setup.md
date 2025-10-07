# 📚 Knowledge Base セットアップガイド

## 概要

このガイドでは、Amazon Bedrock Knowledge BaseとOpenSearch Serverlessの構築手順を説明します。

---

## 前提条件

- ✅ Phase 1デプロイ完了
- ✅ S3 Documents Bucket作成済み（`eleknowledge-ai-development-documents`）
- ✅ AWS CLI設定済み
- ✅ 適切なIAM権限

---

## 1. OpenSearch Serverless Collection作成（自動）

Phase 2のSAMテンプレートで自動作成されます。

```yaml
Collection Name: EleKnowledge-AI-development-kb
Type: VECTORSEARCH
```

---

## 2. Knowledge Base作成（AWS Console）

### Step 1: Bedrock コンソールにアクセス

1. AWSコンソールにログイン
2. **Amazon Bedrock** を検索
3. 左メニュー → **Knowledge bases**
4. **Create knowledge base** をクリック

### Step 2: Knowledge Base詳細設定

**Knowledge base name:**
```
EleKnowledge-AI-development-kb
```

**IAM Role:**
- **Create and use a new service role** を選択
- または Phase 2で作成されたロールを使用: `EleKnowledge-AI-development-kb-role`

**Next** をクリック

### Step 3: Data Source設定

**Data source name:**
```
s3-documents-source
```

**S3 URI:**
```
s3://eleknowledge-ai-development-documents/
```

**Inclusion prefixes (オプション):**
```
manuals/
policies/
reports/
specifications/
```

**Chunking strategy:**
- **Fixed-size chunking** を選択
- **Max tokens:** 300
- **Overlap:** 20%

**Metadata fields:**
```json
{
  "document-type": "manual",
  "product": "ProductA",
  "model": "v2.0",
  "category": "electrical",
  "department": "engineering"
}
```

**Next** をクリック

### Step 4: Embeddings Model選択

**Embeddings model:**
```
Titan Embeddings G1 - Text
```

**Vector database:**
- **Quick create a new vector store** を選択
- または既存のOpenSearch Serverless Collectionを選択

**Next** をクリック

### Step 5: レビュー＆作成

- 設定内容を確認
- **Create knowledge base** をクリック

**作成時間:** 約5-10分

---

## 3. Knowledge Base IDの取得

Knowledge Base作成完了後：

1. Knowledge base詳細画面を開く
2. **Knowledge base ID** をコピー
   - 例: `ABCD1234EFGH`

### Knowledge Base IDをSSM Parameterに保存

```powershell
# Knowledge Base IDを環境変数として保存
aws ssm put-parameter `
  --name "/EleKnowledge-AI/development/knowledge-base-id" `
  --value "YOUR_KB_ID_HERE" `
  --type "String" `
  --overwrite `
  --profile eleknowledge-dev `
  --region us-east-1
```

---

## 4. ドキュメントのアップロード

### Step 1: S3バケット構造作成

```powershell
# S3バケット構造作成
$bucketName = "eleknowledge-ai-development-documents"

# ディレクトリ作成（空ファイルをアップロード）
$directories = @(
    "manuals/electrical/",
    "manuals/mechanical/",
    "manuals/software/",
    "policies/safety/",
    "policies/quality/",
    "reports/trouble-cases/",
    "reports/maintenance/",
    "specifications/products/",
    "specifications/materials/"
)

foreach ($dir in $directories) {
    # 空ファイル作成でディレクトリを確保
    $tempFile = New-TemporaryFile
    aws s3 cp $tempFile "s3://$bucketName/$dir.keep" --profile eleknowledge-dev
    Remove-Item $tempFile
}
```

### Step 2: サンプルドキュメント準備

**推奨フォーマット:**
- PDF（最も推奨）
- DOCX
- TXT
- Markdown

**ファイル命名規則:**
```
{category}_{product}_{model}_{version}.pdf

例:
manual_ProductA_v2.0_20240101.pdf
policy_safety_general_v1.0.pdf
```

### Step 3: メタデータ付きアップロード

```powershell
# メタデータ付きでアップロード
aws s3 cp "local-manual.pdf" `
  "s3://$bucketName/manuals/electrical/manual_ProductA_v2.0.pdf" `
  --metadata document-type=manual,product=ProductA,model=v2.0,category=electrical `
  --profile eleknowledge-dev

# 複数ファイルを一括アップロード
aws s3 sync "local-docs/" `
  "s3://$bucketName/manuals/" `
  --profile eleknowledge-dev
```

**メタデータスキーマ:**
```json
{
  "document-type": "manual",
  "product": "ProductA",
  "model": "v2.0",
  "category": "electrical",
  "department": "engineering",
  "version": "2.0",
  "published-date": "2024-01-01",
  "author": "Engineering Team"
}
```

---

## 5. Knowledge Base同期

### AWS Consoleから同期

1. Bedrock → Knowledge bases
2. 作成したKnowledge baseを選択
3. **Data sources** タブ
4. データソース名をクリック
5. **Sync** ボタンをクリック

**同期時間:** ドキュメント数に応じて5分〜30分

### CLIから同期

```powershell
# Data Source IDを取得
$kbId = "YOUR_KB_ID"
$dataSourceId = aws bedrock-agent list-data-sources `
  --knowledge-base-id $kbId `
  --profile eleknowledge-dev `
  --query 'dataSourceSummaries[0].dataSourceId' `
  --output text

# 同期開始
aws bedrock-agent start-ingestion-job `
  --knowledge-base-id $kbId `
  --data-source-id $dataSourceId `
  --profile eleknowledge-dev `
  --region us-east-1
```

### 同期状態確認

```powershell
# 最新の同期ジョブ状態確認
aws bedrock-agent list-ingestion-jobs `
  --knowledge-base-id $kbId `
  --data-source-id $dataSourceId `
  --max-results 1 `
  --profile eleknowledge-dev `
  --region us-east-1 `
  --query 'ingestionJobSummaries[0].[status,statistics]'
```

---

## 6. Knowledge Baseテスト

### AWS Consoleからテスト

1. Knowledge base詳細画面
2. **Test knowledge base** セクション
3. テストクエリを入力
   ```
   配線の接続方法を教えてください
   ```
4. **Run** をクリック
5. 検索結果と関連文書を確認

### CLIからテスト

```powershell
# Knowledge Baseクエリテスト
$testQuery = "配線の接続方法を教えてください"

aws bedrock-agent-runtime retrieve `
  --knowledge-base-id $kbId `
  --retrieval-query text="$testQuery" `
  --profile eleknowledge-dev `
  --region us-east-1 `
  --output json
```

**期待される結果:**
- 関連文書が10件まで返却される
- relevanceScoreが高い順
- メタデータが含まれる

---

## 7. Phase 2デプロイ

Knowledge Base作成完了後、Phase 2をデプロイします。

### Step 1: Knowledge Base IDを更新

```powershell
# .envファイルに追加
echo "BEDROCK_KB_ID=YOUR_KB_ID_HERE" >> .env
```

### Step 2: SAMデプロイ

```powershell
cd infrastructure\sam

# Build
sam build --template phase2-template.yaml --use-container

# Deploy
sam deploy `
  --stack-name EleKnowledge-AI-development-phase2 `
  --profile eleknowledge-dev `
  --region us-east-1 `
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM `
  --parameter-overrides `
    "Environment=development" `
    "ProjectName=EleKnowledge-AI" `
    "Phase1StackName=EleKnowledge-AI-development-phase1"
```

---

## 8. トラブルシューティング

### Knowledge Base同期エラー

**エラー:** "Access Denied"
**解決策:**
1. IAM Roleの権限確認
2. S3バケットポリシー確認
3. OpenSearch Serverless Data Access Policy確認

### 検索結果が返らない

**原因:**
- ドキュメントが同期されていない
- メタデータフィルターが厳しすぎる

**解決策:**
1. 同期ジョブのステータス確認
2. フィルター条件を緩和
3. ドキュメントの内容・メタデータを確認

### Embedding エラー

**エラー:** "ThrottlingException"
**解決策:**
- 同期を分割実行
- バッチサイズを小さくする

---

## 9. ベストプラクティス

### ドキュメント管理

1. **命名規則の統一**
   - ファイル名に意味のある名前を付ける
   - バージョン番号を含める

2. **メタデータの統一**
   - すべてのドキュメントに必須メタデータを設定
   - 検索性を高めるため

3. **定期的な更新**
   - 週次でドキュメント追加
   - 古いドキュメントのアーカイブ

### パフォーマンス最適化

1. **適切なChunk Size**
   - 技術文書: 300-500 tokens
   - マニュアル: 200-300 tokens

2. **検索結果数の調整**
   - 通常: 5-10件
   - 詳細検索: 15-20件

3. **キャッシュ戦略**
   - よく検索されるクエリのキャッシュ
   - API Gatewayキャッシング活用

---

## 10. 完了チェックリスト

- [ ] OpenSearch Serverless Collection作成完了
- [ ] Knowledge Base作成完了
- [ ] S3にドキュメントアップロード完了
- [ ] メタデータ設定完了
- [ ] Knowledge Base同期完了
- [ ] テストクエリで正常な結果を取得
- [ ] Knowledge Base IDをSSM Parameterに保存
- [ ] Phase 2 SAMテンプレートデプロイ完了

---

**完了したら、Phase 2のデプロイに進んでください！**
