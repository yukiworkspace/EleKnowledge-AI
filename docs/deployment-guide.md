# 🚀 EleKnowledge-AI デプロイ手順書

## 目次

1. [概要](#1-概要)
2. [前提条件](#2-前提条件)
3. [Phase 1: 基盤整備のデプロイ](#3-phase-1-基盤整備のデプロイ)
4. [Phase 2: RAGチャット機能のデプロイ](#4-phase-2-ragチャット機能のデプロイ)
5. [WAF設定](#5-waf設定)
6. [Amplify Hostingデプロイ](#6-amplify-hostingデプロイ)
7. [トラブルシューティング](#7-トラブルシューティング)

---

## 1. 概要

このドキュメントでは、EleKnowledge-AIのAWSインフラストラクチャをデプロイする手順を説明します。

### デプロイ方式

- **Infrastructure as Code:** AWS SAM (Serverless Application Model)
- **スクリプト:** PowerShell
- **プロファイル管理:** AWS CLI プロファイル

### デプロイの流れ

```
Phase 1: 基盤整備 (2ヶ月)
  ├─ SAM Deploy
  │   ├─ Cognito User Pool
  │   ├─ DynamoDB Tables
  │   ├─ S3 Buckets
  │   ├─ Lambda Functions (認証)
  │   └─ API Gateway (認証API)
  ├─ WAF設定 (手動)
  └─ Amplify Hosting (手動)

Phase 2: RAGチャット機能 (2ヶ月)
  ├─ Knowledge Base構築 (AWS CLI)
  ├─ SAM Deploy
  │   ├─ Lambda Functions (RAG、チャット管理)
  │   └─ API Gateway (RAG API、チャット管理API)
  └─ フロントエンドデプロイ (Amplify)
```

---

## 2. 前提条件

### 2.1 必要なツール

すべてインストール済みであることを確認してください：

```powershell
# AWS CLI確認
aws --version

# SAM CLI確認
sam --version

# Git確認
git --version

# Node.js確認（フロントエンド用）
node --version
npm --version
```

### 2.2 AWS認証情報

開発用プロファイルが設定されていることを確認：

```powershell
# プロファイル一覧確認
aws configure list-profiles

# 認証情報確認
aws sts get-caller-identity --profile eleknowledge-dev
```

### 2.3 必要な権限

IAMユーザーに以下の権限が必要です：

- CloudFormation Full Access
- Lambda Full Access
- API Gateway Administrator
- Cognito Power User
- DynamoDB Full Access
- S3 Full Access
- IAM Full Access（ロール作成のため）
- CloudWatch Logs Full Access

---

## 3. Phase 1: 基盤整備のデプロイ

### 3.1 事前準備

#### プロジェクトディレクトリに移動

```powershell
cd C:\Users\<ユーザー名>\devspace
```

#### Gitリポジトリの最新化

```powershell
git pull origin main
```

### 3.2 デプロイスクリプトの実行

#### 方法1: 対話的デプロイ（推奨・初回）

```powershell
.\infrastructure\scripts\setup-phase1.ps1 -Profile eleknowledge-dev -Environment development
```

**実行内容:**
1. 前提条件チェック
2. SAMアーティファクトバケット作成
3. Lambda関数コードの準備確認
4. SAM Build実行
5. SAM Deploy実行（確認プロンプトあり）
6. デプロイ結果の表示

#### 方法2: 自動デプロイ（確認スキップ）

```powershell
.\infrastructure\scripts\setup-phase1.ps1 -Profile eleknowledge-dev -Environment development -SkipConfirmation
```

#### 方法3: ガイド付きデプロイ（SAM CLI対話モード）

```powershell
.\infrastructure\scripts\setup-phase1.ps1 -Profile eleknowledge-dev -Environment development -Guided
```

### 3.3 デプロイの確認

#### CloudFormationスタック確認

```powershell
aws cloudformation describe-stacks `
  --stack-name EleKnowledge-AI-development-phase1 `
  --profile eleknowledge-dev `
  --region us-east-1 `
  --query 'Stacks[0].StackStatus'
```

**期待される出力:** `"CREATE_COMPLETE"` または `"UPDATE_COMPLETE"`

#### リソース確認

```powershell
# Cognito User Pool確認
aws cognito-idp list-user-pools --max-results 10 --profile eleknowledge-dev --region us-east-1

# DynamoDB テーブル確認
aws dynamodb list-tables --profile eleknowledge-dev --region us-east-1

# S3 バケット確認
aws s3 ls --profile eleknowledge-dev

# Lambda 関数確認
aws lambda list-functions --profile eleknowledge-dev --region us-east-1 --query 'Functions[?contains(FunctionName, `EleKnowledge-AI`)].FunctionName'
```

### 3.4 環境変数の更新

デプロイ完了後、スクリプトが表示する環境変数を `.env` ファイルに追加：

```bash
# .env ファイルに追加
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
DYNAMODB_USERS_TABLE=EleKnowledge-AI-development-users
DYNAMODB_CHATLOGS_TABLE=EleKnowledge-AI-development-chatlogs
S3_DOCUMENTS_BUCKET=eleknowledge-ai-development-documents
S3_UPLOADS_BUCKET=eleknowledge-ai-development-uploads
API_GATEWAY_AUTH_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/development
```

### 3.5 Lambda関数の実装

プレースホルダーが作成されているので、実装を進めます：

```
lambda/
├── auth/
│   ├── signup/
│   │   ├── app.py          ← 実装が必要
│   │   └── requirements.txt
│   ├── login/
│   │   ├── app.py          ← 実装が必要
│   │   └── requirements.txt
│   └── verify/
│       ├── app.py          ← 実装が必要
│       └── requirements.txt
```

#### Lambda関数の更新デプロイ

実装完了後、再度デプロイ：

```powershell
cd infrastructure\sam
sam build --template phase1-template.yaml
sam deploy --stack-name EleKnowledge-AI-development-phase1 --profile eleknowledge-dev --region us-east-1 --no-confirm-changeset
```

### 3.6 ローカルテスト（オプション）

#### Docker Desktop起動

SAMローカルテストにはDockerが必要です。

#### Lambda関数のローカル実行

```powershell
# イベントファイル作成
New-Item -ItemType Directory -Force -Path lambda/auth/signup/events
New-Item -ItemType File -Path lambda/auth/signup/events/test-event.json

# テストイベントの内容例
@"
{
  "body": "{\"email\":\"test@example.com\",\"password\":\"Test1234!\"}",
  "headers": {
    "Content-Type": "application/json"
  }
}
"@ | Set-Content lambda/auth/signup/events/test-event.json

# ローカル実行
cd infrastructure\sam
sam local invoke SignupFunction --event ../../lambda/auth/signup/events/test-event.json
```

---

## 4. Phase 2: RAGチャット機能のデプロイ

### 4.1 事前準備

#### Phase 1の完了確認

```powershell
aws cloudformation describe-stacks `
  --stack-name EleKnowledge-AI-development-phase1 `
  --profile eleknowledge-dev `
  --region us-east-1 `
  --query 'Stacks[0].StackStatus'
```

### 4.2 Knowledge Base構築

#### ドキュメントの準備

```powershell
# ドキュメント用ディレクトリ作成
New-Item -ItemType Directory -Force -Path documents/manuals
New-Item -ItemType Directory -Force -Path documents/policies
New-Item -ItemType Directory -Force -Path documents/reports
New-Item -ItemType Directory -Force -Path documents/specifications

# ドキュメント配置
# documents/ 配下にPDFやテキストファイルを配置
```

#### S3へのアップロード

```powershell
# Phase 1で作成されたバケット名を環境変数から取得
$bucketName = $env:S3_DOCUMENTS_BUCKET

# ドキュメントをアップロード
aws s3 sync documents/ "s3://$bucketName/" --profile eleknowledge-dev

# アップロード確認
aws s3 ls "s3://$bucketName/" --recursive --profile eleknowledge-dev
```

#### Knowledge Base作成（AWS CLI）

```powershell
# Knowledge Base作成スクリプトを実行
.\infrastructure\scripts\setup-knowledge-base.ps1 -Profile eleknowledge-dev -Environment development
```

**注:** `setup-knowledge-base.ps1` は別途作成が必要です。

### 4.3 Phase 2 SAMデプロイ

```powershell
# Phase 2デプロイスクリプト実行
.\infrastructure\scripts\setup-phase2.ps1 -Profile eleknowledge-dev -Environment development
```

### 4.4 デプロイ確認

```powershell
# Phase 2スタック確認
aws cloudformation describe-stacks `
  --stack-name EleKnowledge-AI-development-phase2 `
  --profile eleknowledge-dev `
  --region us-east-1 `
  --query 'Stacks[0].StackStatus'
```

---

## 5. WAF設定

### 5.1 WAF ACL作成

AWS CLIでWAF ACLを作成：

```powershell
# WAF ACL作成
aws wafv2 create-web-acl `
  --name eleknowledge-ai-dev-waf `
  --scope CLOUDFRONT `
  --region us-east-1 `
  --default-action Allow={} `
  --profile eleknowledge-dev
```

### 5.2 IP Set作成

```powershell
# IP Set作成
aws wafv2 create-ip-set `
  --name eleknowledge-ai-allowed-ips `
  --scope CLOUDFRONT `
  --ip-address-version IPV4 `
  --addresses "192.168.28.0/24" `
  --region us-east-1 `
  --profile eleknowledge-dev
```

### 5.3 WAFルール追加

#### IP許可リストルール

```powershell
# ルール設定JSON作成
$ruleJson = @"
{
  "Name": "AllowOnlyInternalIP",
  "Priority": 1,
  "Statement": {
    "IPSetReferenceStatement": {
      "Arn": "arn:aws:wafv2:us-east-1:ACCOUNT_ID:global/ipset/eleknowledge-ai-allowed-ips/ID"
    }
  },
  "Action": {
    "Allow": {}
  },
  "VisibilityConfig": {
    "SampledRequestsEnabled": true,
    "CloudWatchMetricsEnabled": true,
    "MetricName": "AllowOnlyInternalIP"
  }
}
"@

# WAF ACLにルールを追加
aws wafv2 update-web-acl `
  --name eleknowledge-ai-dev-waf `
  --scope CLOUDFRONT `
  --id WAF_ACL_ID `
  --lock-token LOCK_TOKEN `
  --rules file://waf-rules.json `
  --region us-east-1 `
  --profile eleknowledge-dev
```

### 5.4 レート制限ルール

```powershell
# レート制限ルール追加（500 req/5min/IP）
# AWS Consoleで設定することを推奨
```

**手動設定が必要な理由:**
- WAFルールの複雑な設定はAWS Consoleの方が視覚的で確実
- レート制限の調整が容易

### 5.5 WAF設定確認

```powershell
# WAF ACL一覧
aws wafv2 list-web-acls --scope CLOUDFRONT --region us-east-1 --profile eleknowledge-dev

# IP Set一覧
aws wafv2 list-ip-sets --scope CLOUDFRONT --region us-east-1 --profile eleknowledge-dev
```

---

## 6. Amplify Hostingデプロイ

### 6.1 Next.jsプロジェクトの準備

#### プロジェクト作成（初回のみ）

```powershell
# フロントエンドディレクトリ作成
cd C:\Users\<ユーザー名>\devspace
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir

cd frontend
```

#### Amplify設定

```powershell
# Amplify CLI インストール（グローバル）
npm install -g @aws-amplify/cli

# Amplify初期化
amplify init
```

### 6.2 Amplify Hostingセットアップ（AWS Console）

**手順:**

1. **AWS Amplify Console** を開く
   ```
   https://console.aws.amazon.com/amplify/
   ```

2. **アプリケーションを作成**
   - アプリ名: `EleKnowledge-AI`
   - リポジトリ: GitHub連携
   - ブランチ: `main` (本番), `develop` (開発)

3. **ビルド設定**
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```

4. **環境変数設定**
   - `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
   - `NEXT_PUBLIC_COGNITO_CLIENT_ID`
   - `NEXT_PUBLIC_API_GATEWAY_AUTH_URL`
   - （その他 `.env.example` 参照）

5. **デプロイ**
   - Git pushで自動デプロイ開始

### 6.3 WAF ACLをAmplifyにアタッチ

**AWS Console:**

1. Amplify Console → App settings → Access control
2. "Associate web ACL" を選択
3. 作成したWAF ACLを選択
4. 保存

---

## 7. トラブルシューティング

### 7.1 SAM Deploy失敗

#### エラー: "Unable to upload artifact"

**原因:** S3バケットが作成されていない

**解決方法:**
```powershell
# SAMアーティファクトバケット作成
aws s3 mb s3://eleknowledge-ai-development-sam-artifacts --region us-east-1 --profile eleknowledge-dev
```

#### エラー: "Role is not authorized"

**原因:** IAMユーザーに権限が不足

**解決方法:**
- AWS Consoleで IAMユーザーの権限を確認
- 必要な権限ポリシーをアタッチ

### 7.2 Lambda実行エラー

#### エラー: "Module not found"

**原因:** requirements.txtの依存関係が不足

**解決方法:**
```powershell
# requirements.txt更新
cd lambda/auth/signup
pip install -r requirements.txt -t .

# 再デプロイ
cd ../../../infrastructure/sam
sam build
sam deploy --stack-name EleKnowledge-AI-development-phase1 --profile eleknowledge-dev --no-confirm-changeset
```

### 7.3 Cognito認証エラー

#### エラー: "User pool does not exist"

**原因:** 環境変数が正しくない

**解決方法:**
```powershell
# スタック出力から正しい値を取得
aws cloudformation describe-stacks `
  --stack-name EleKnowledge-AI-development-phase1 `
  --profile eleknowledge-dev `
  --region us-east-1 `
  --query 'Stacks[0].Outputs'

# .env ファイルを更新
```

### 7.4 WAFブロックされる

#### 症状: 403 Forbidden

**原因:** 自分のIPがWAFでブロックされている

**解決方法:**
```powershell
# 現在のIPを確認
curl https://api.ipify.org

# IP SetにIPを追加（AWS Console推奨）
```

---

## 8. デプロイチェックリスト

### Phase 1完了チェック

- [ ] CloudFormation スタック作成成功
- [ ] Cognito User Pool作成確認
- [ ] DynamoDB テーブル作成確認
- [ ] S3 バケット作成確認
- [ ] Lambda関数デプロイ確認
- [ ] API Gateway作成確認
- [ ] 環境変数ファイル更新
- [ ] Lambda関数実装完了
- [ ] Lambda関数テスト成功

### Phase 2完了チェック

- [ ] Knowledge Base作成確認
- [ ] ドキュメントアップロード完了
- [ ] RAG Lambda デプロイ確認
- [ ] チャット管理Lambda デプロイ確認
- [ ] API Gateway作成確認
- [ ] 環境変数ファイル更新
- [ ] E2Eテスト成功

### インフラ全体完了チェック

- [ ] WAF ACL作成・設定完了
- [ ] Amplify Hosting デプロイ完了
- [ ] WAF ACL アタッチ完了
- [ ] IP制限動作確認
- [ ] 全機能動作確認
- [ ] ドキュメント更新

---

## 9. 参考リンク

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [AWS CLI Command Reference](https://awscli.amazonaws.com/v2/documentation/api/latest/index.html)
- [AWS Amplify Hosting](https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html)
- [AWS WAF Developer Guide](https://docs.aws.amazon.com/waf/latest/developerguide/)

---

**最終更新:** 2025-10-03  
**作成者:** Development Team
