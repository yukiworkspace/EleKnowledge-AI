# 📄 PDF自動分割機能セットアップガイド

## 概要

Knowledge Baseに保管するPDFファイルのサイズ制限（50MB）に対応するため、大きなPDFを自動的に45MB以下に分割するLambda関数を設定します。

---

## PDF分割の仕組み

### トリガー
S3バケット（`eleknowledge-ai-development-documents`）にPDFファイルがアップロードされると、自動的にLambda関数が起動します。

### 処理フロー
```
1. S3にPDFアップロード
   ↓
2. S3イベント通知 → PDF Splitter Lambda起動
   ↓
3. ファイルサイズチェック
   ├─ 45MB以下 → 処理スキップ（そのまま使用）
   └─ 45MB超過 → 分割処理開始
   ↓
4. PDF分割
   ├─ ページ単位で分割
   ├─ 各チャンク45MB以下
   └─ メタデータ保持
   ↓
5. 分割ファイルをS3にアップロード
   ├─ original_file_part1.pdf
   ├─ original_file_part2.pdf
   └─ ...
   ↓
6. 元ファイルにタグ付け
   └─ Status: Split
```

### 命名規則
```
元ファイル: manual_ProductA_v2.0.pdf (60MB)
↓
分割後:
- manual_ProductA_v2.0_part1.pdf (45MB)
- manual_ProductA_v2.0_part2.pdf (15MB)
```

---

## セットアップ手順

### Step 1: Phase 2デプロイ（PDF Splitter Lambda含む）

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
    Environment=development `
    ProjectName=EleKnowledge-AI `
    Phase1StackName=EleKnowledge-AI-development-phase1
```

### Step 2: S3イベント通知の設定

Phase 1で作成されたS3バケットにイベント通知を追加します。

#### 方法1: AWS CLI（推奨）

```powershell
# バケット名を取得
$bucketName = aws cloudformation describe-stacks `
  --stack-name EleKnowledge-AI-development-phase1 `
  --profile eleknowledge-dev `
  --query 'Stacks[0].Outputs[?OutputKey==`DocumentsBucketName`].OutputValue' `
  --output text

# Lambda関数ARNを取得
$lambdaArn = aws cloudformation describe-stacks `
  --stack-name EleKnowledge-AI-development-phase2 `
  --profile eleknowledge-dev `
  --query 'Stacks[0].Outputs[?OutputKey==`PdfSplitterFunctionArn`].OutputValue' `
  --output text

# Lambda権限を追加（S3からの呼び出し許可）
aws lambda add-permission `
  --function-name EleKnowledge-AI-development-pdf-splitter `
  --principal s3.amazonaws.com `
  --statement-id s3-invoke-pdf-splitter `
  --action lambda:InvokeFunction `
  --source-arn "arn:aws:s3:::$bucketName" `
  --profile eleknowledge-dev `
  --region us-east-1

# S3イベント通知設定
$notificationConfig = @"
{
  "LambdaFunctionConfigurations": [
    {
      "Id": "pdf-splitter-trigger",
      "LambdaFunctionArn": "$lambdaArn",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {
              "Name": "suffix",
              "Value": ".pdf"
            }
          ]
        }
      }
    }
  ]
}
"@

# 通知設定を適用
$notificationConfig | Out-File -FilePath "notification-config.json" -Encoding UTF8
aws s3api put-bucket-notification-configuration `
  --bucket $bucketName `
  --notification-configuration file://notification-config.json `
  --profile eleknowledge-dev
Remove-Item notification-config.json
```

#### 方法2: AWS Console

1. **S3コンソール**にアクセス
2. バケット `eleknowledge-ai-development-documents` を選択
3. **Properties** タブ
4. **Event notifications** セクション
5. **Create event notification** をクリック

**設定値:**
- **Name**: `pdf-splitter-trigger`
- **Event types**: `All object create events` を選択
- **Destination**: `Lambda function`
- **Lambda function**: `EleKnowledge-AI-development-pdf-splitter`
- **Suffix**: `.pdf`

6. **Save changes** をクリック

---

## テスト

### Step 1: テストPDFの準備

サイズの大きいPDFファイルを準備（50MB以上推奨）

### Step 2: アップロード

```powershell
# メタデータ付きでアップロード
$bucketName = "eleknowledge-ai-development-documents"

aws s3 cp "large-manual.pdf" `
  "s3://$bucketName/manuals/test/large-manual.pdf" `
  --metadata document-type=manual,product=TestProduct,model=v1.0 `
  --profile eleknowledge-dev
```

### Step 3: CloudWatch Logsで確認

```powershell
# Lambda実行ログを確認
aws logs tail "/aws/lambda/EleKnowledge-AI-development-pdf-splitter" `
  --follow `
  --profile eleknowledge-dev `
  --region us-east-1
```

**期待されるログ:**
```
Processing file: manuals/test/large-manual.pdf (60.00 MB)
File exceeds 45MB, splitting...
Split into 2 chunks
Uploaded chunk 1: manuals/test/large-manual_part1.pdf (45.00 MB)
Uploaded chunk 2: manuals/test/large-manual_part2.pdf (15.00 MB)
Successfully split manuals/test/large-manual.pdf into 2 parts
```

### Step 4: S3で分割ファイルを確認

```powershell
# 分割ファイルの確認
aws s3 ls "s3://$bucketName/manuals/test/" `
  --profile eleknowledge-dev `
  --recursive `
  --human-readable
```

**期待される出力:**
```
60 MB  large-manual.pdf
45 MB  large-manual_part1.pdf
15 MB  large-manual_part2.pdf
```

---

## 動作条件

### 処理対象ファイル
- ✅ 拡張子が `.pdf`
- ✅ ファイルサイズが45MB超過
- ✅ ファイル名に `_part` が含まれていない（分割済みファイルを除外）
- ✅ `processed/` または `tmp/` ディレクトリ配下でない

### 処理スキップ条件
- ❌ PDFでないファイル（.docx, .txt など）
- ❌ 45MB以下のPDF
- ❌ 既に分割済みのファイル（`_part` 含む）
- ❌ `processed/` または `tmp/` ディレクトリ配下のファイル

---

## メタデータの引き継ぎ

元のPDFファイルに設定されたメタデータは、すべての分割ファイルに自動的に引き継がれます。

**例:**
```powershell
# 元ファイルのメタデータ
document-type: manual
product: ProductA
model: v2.0

# 分割後もすべてのファイルで同じメタデータ
large-manual_part1.pdf → document-type: manual, product: ProductA, model: v2.0
large-manual_part2.pdf → document-type: manual, product: ProductA, model: v2.0
```

---

## トラブルシューティング

### Lambda関数が起動しない

**原因:**
- S3イベント通知が設定されていない
- Lambda権限が不足

**解決策:**
```powershell
# イベント通知設定を確認
aws s3api get-bucket-notification-configuration `
  --bucket $bucketName `
  --profile eleknowledge-dev

# Lambda権限を確認
aws lambda get-policy `
  --function-name EleKnowledge-AI-development-pdf-splitter `
  --profile eleknowledge-dev `
  --region us-east-1
```

### 分割に失敗する

**原因:**
- PDFファイルが破損している
- メモリ不足

**解決策:**
1. PDFファイルの整合性を確認
2. Lambda関数のメモリを増やす（現在3008MB）

### タイムアウト

**原因:**
- 非常に大きいPDFファイル（200MB以上）

**解決策:**
1. Lambda Timeout延長（現在900秒 = 15分）
2. ファイルを事前に分割してアップロード

---

## ベストプラクティス

### 1. ファイルサイズ確認

アップロード前にファイルサイズを確認：
```powershell
# ファイルサイズ確認（MB単位）
(Get-Item "large-manual.pdf").Length / 1MB
```

### 2. 段階的アップロード

大量のファイルを一度にアップロードせず、少しずつアップロード：
```powershell
# 1つずつアップロード（Lambda処理を確認しながら）
foreach ($file in Get-ChildItem "*.pdf") {
    aws s3 cp $file.FullName "s3://$bucketName/manuals/" --profile eleknowledge-dev
    Start-Sleep -Seconds 30  # 30秒待機
}
```

### 3. CloudWatchモニタリング

Lambda実行状況を監視：
- 実行時間
- メモリ使用量
- エラー発生率

---

## コスト試算

### PDF Splitter Lambda

**想定:**
- 1日10ファイルアップロード
- 平均ファイルサイズ: 60MB
- 平均処理時間: 30秒
- メモリ: 3008MB

**月間コスト:**
- Lambda実行: $0.30/月
- S3 API コール: $0.01/月
- **合計**: 約 $0.31/月

---

## 完了チェックリスト

- [ ] Phase 2デプロイ完了（PDF Splitter Lambda含む）
- [ ] S3イベント通知設定完了
- [ ] Lambda権限設定完了
- [ ] テストPDFアップロード成功
- [ ] 分割ファイル確認完了
- [ ] CloudWatch Logs確認完了
- [ ] メタデータ引き継ぎ確認完了

---

**セットアップ完了後、大きなPDFファイルをアップロードして、自動分割を確認してください！**
