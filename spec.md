# 📘 EleKnowledge-AI システム仕様書

## プロジェクト情報

**プロジェクト名:** EleKnowledge-AI  
**バージョン:** 1.0.1  
**最終更新日:** 2025-10-15  
**作成者:** Development Team  
**ステータス:** Phase 2 開発中

---

## 目次

1. [システム概要](#1-システム概要)
2. [アーキテクチャ](#2-アーキテクチャ)
3. [機能仕様](#3-機能仕様)
4. [技術スタック](#4-技術スタック)
5. [セキュリティ](#5-セキュリティ)
6. [データモデル](#6-データモデル)
7. [API仕様](#7-api仕様)
8. [デプロイ構成](#8-デプロイ構成)
9. [開発ロードマップ](#9-開発ロードマップ)
10. [運用・保守](#10-運用保守)

---

## 1. システム概要

### 1.1 プロジェクト目的

EleKnowledge-AIは、昇降機に関する知識を集約し、AIを活用して以下の業務を支援するシステムです：

- 📚 **RAGチャット**: 技術資料・マニュアルの検索と質問応答
- 🔧 **トラブルシューティング**: 現場トラブルの原因分析と対処方法の提案
- ✅ **品質書類チェック**: 技評写真の自動判定と品質管理

### 1.2 対象ユーザー

- 現場代理人
- 現場作業員
- 品質管理担当者
- 保守・メンテナンス担当者

### 1.3 システム特徴

- ✅ 社内ネットワーク限定アクセス（IP制限）
- ✅ Amazon Bedrock Claude 4による高精度AI応答
- ✅ マルチエージェント協調による複雑な問題解決
- ✅ セキュアなAWS環境での運用

---

## 2. アーキテクチャ

### 2.1 システム全体図

```
┌─────────────────────────────────────────────────────────────┐
│                     社内ネットワーク                          │
│                   (IP: 192.168.28.0/24)                       │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTPS
                  ▼
┌─────────────────────────────────────────────────────────────┐
│               AWS Amplify Hosting                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              AWS WAF (統合)                           │   │
│  │  • IP制限: 192.168.28.0/24 のみ許可                   │   │
│  │  • レート制限: 2000 req/5min                         │   │
│  │  • マネージドルール: SQL Injection 防御               │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Next.js Application                         │   │
│  │  • ホーム画面                                         │   │
│  │  • RAGチャット画面                                    │   │
│  │  • トラブルシューティング画面                         │   │
│  │  • 品質書類チェック画面                               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTPS + Cognito Token
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Amazon API Gateway (3つのAPI)                   │
│  ┌──────────────┬──────────────┬──────────────────────┐     │
│  │ 認証API      │ RAG処理API   │ チャット管理API      │     │
│  └──────────────┴──────────────┴──────────────────────┘     │
│  • Cognito認証統合                                           │
│  • Gateway Response設定                                      │
│  • レート制限 (Throttling)                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                  AWS Lambda Functions                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 認証Lambda群                                         │    │
│  │  • login-function                                   │    │
│  │  • signup-function                                  │    │
│  │  • verify-function                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ RAG処理Lambda                                        │    │
│  │  • rag-function                                     │    │
│  │  • KB検索 + Claude 4応答生成                        │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ チャット管理Lambda                                   │    │
│  │  • chat-management-function                         │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 新機能Lambda (Phase 3で追加)                         │    │
│  │  • troubleshooting-lambda                           │    │
│  │  • quality-check-lambda                             │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│           VPC: eleknowledge-vpc (192.168.28.0/24)           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Private Subnets                                      │    │
│  │  • eleknowledge-private-1a (192.168.28.0/26)        │    │
│  │  • eleknowledge-private-1b (192.168.28.64/26)       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                    AWS Services                              │
│  ┌──────────┬──────────┬──────────┬──────────┬─────────┐    │
│  │ Cognito  │ DynamoDB │ Bedrock  │ S3       │ Secrets │    │
│  │ User Pool│ Tables   │ KB+Agent │ Storage  │ Manager │    │
│  └──────────┴──────────┴──────────┴──────────┴─────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 コンポーネント構成

#### フロントエンド
- **Framework:** Next.js 14 (App Router)
- **UI Library:** Tailwind CSS + shadcn/ui
- **状態管理:** React Context API / Zustand
- **ホスティング:** AWS Amplify Hosting

#### バックエンド
- **API Gateway:** 3つの独立したREST API
- **Lambda Runtime:** Python 3.11 / Node.js 18
- **認証:** AWS Cognito User Pool

#### AI/ML
- **LLM:** Amazon Bedrock Claude 4 Sonnet
- **Vector Store:** Amazon Bedrock Knowledge Base
- **Multi-Agent:** Amazon Bedrock Agent (Phase 3)

#### データストア
- **User DB:** Amazon DynamoDB (users)
- **Chat History:** Amazon DynamoDB (eleknowledge-chatlogs)
- **Document Storage:** Amazon S3
- **IP Whitelist:** Amazon DynamoDB (ip-whitelist)

---

## 3. 機能仕様

### 3.1 Phase 1: 基盤整備（2ヶ月）

#### 3.1.1 認証システム

**Phase 1実装機能:**
- ユーザー登録（サインアップ）
- ログイン・ログアウト
- パスワードリセット
- MFA（多要素認証）※オプション

**将来的な拡張（Phase 4以降）:**
- SAML 2.0統合（社内IdP連携）
- OIDC統合（Google Workspace等）
- Cognito Identity Providerとして統合

**技術実装:**
```typescript
// AWS Cognito統合
import { Auth } from 'aws-amplify';

// サインアップ
const signUp = async (email: string, password: string) => {
  await Auth.signUp({
    username: email,
    password,
    attributes: {
      email
    }
  });
};

// ログイン
const signIn = async (email: string, password: string) => {
  const user = await Auth.signIn(email, password);
  return user;
};
```

**セキュリティ要件:**
- パスワード: 8文字以上、大文字・小文字・数字・記号必須
- セッション有効期限: 24時間
- 失敗回数制限: 5回でアカウントロック（15分）

**トークン管理:**
- **Access Token:** 1時間（短命）
- **Refresh Token:** 30日（長命）
- **ID Token:** 1時間
- **自動リフレッシュ:** 有効期限5分前に自動更新
- **トークン保存:** localStorage（開発環境）/ httpOnly Cookie（本番推奨）

**CORS設定:**
```typescript
// API Gateway CORS設定
{
  "allowedOrigins": [
    "https://eleknowledge-ai.amplifyapp.com",
    "http://localhost:3000" // 開発環境のみ
  ],
  "allowedMethods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  "allowedHeaders": ["Content-Type", "Authorization"],
  "allowCredentials": true,
  "maxAge": 3600
}
```

#### 3.1.2 ホーム画面

**機能:**
- ログイン後のランディングページ
- 3つの主要機能への導線
- ユーザー情報表示

**UI構成:**
```
┌─────────────────────────────────────────────┐
│  EleKnowledge-AI               👤 user@... │
├─────────────────────────────────────────────┤
│                                             │
│  🤖 RAGチャット                              │
│  技術資料・マニュアルの検索と質問応答         │
│  [開始する →]                                │
│                                             │
│  🔧 トラブルシューティング  🚧 開発中         │
│  現場トラブルの原因分析と対処方法提案         │
│  [準備中]                                    │
│                                             │
│  ✅ 品質書類チェック  🚧 開発中               │
│  技評の自動判定　　　　　　　　                │
│  [準備中]                                    │
│                                             │
└─────────────────────────────────────────────┘
```

**画面遷移:**
```
ログイン → ホーム画面
         ├─ RAGチャット画面
         ├─ トラブルシューティング画面（開発中表示）
         └─ 品質書類チェック画面（開発中表示）
```

#### 3.1.3 IP制限設定

**AWS Amplify WAF v2統合機能（2024年追加）:**

2024年にAmplifyがWAF直接統合機能を追加したため、CloudFront経由の追加設定は不要です。

**実装手順:**
1. Amplifyコンソール → App settings → Access control
2. WAF ACLを作成・アタッチ
3. IPセットルールで社内IPを許可

**許可IPリスト:**
```bash
192.168.28.0/24    # 社内ネットワーク（20人同時接続想定）
```

**WAFルール設定:**

| 優先度 | ルール名 | タイプ | 設定内容 |
|-------|---------|--------|---------|
| 1 | IP許可リスト | IP Set | 192.168.28.0/24のみ許可 |
| 2 | レート制限（IP） | Rate-based | 500 req/5min/IP |
| 3 | レート制限（全体） | Rate-based | 2000 req/5min |
| 4 | SQLインジェクション | Managed Rule | AWS-AWSManagedRulesSQLiRuleSet |
| 5 | 共通攻撃防御 | Managed Rule | AWS-AWSManagedRulesCommonRuleSet |

**コスト:**
- WAF基本料金: $5/月
- ルール単価: $1/月 × 5ルール = $5/月
- リクエスト単価: $0.60/100万リクエスト
- **月間想定:** 約$11/月（2万リクエスト想定）

**監視:**
- CloudWatch Logsでブロックログ記録
- ブロック回数が閾値超過時にアラート通知

### 3.2 Phase 2: RAGチャット機能（2ヶ月）

#### 3.2.1 RAGチャット画面

**主要機能:**
- リアルタイムチャット
- チャット履歴表示
- セッション管理
- 引用文書表示
- 文書ダウンロード
- フィードバック機能（👍👎）
- メタデータフィルター検索

**UI構成:**
```
┌─────────────────────────────────────────────────────────┐
│ 📚 RAGチャット                    👤 user@example.com  │
├──────────┬──────────────────────────────────────────────┤
│ サイドバー │ メインチャット画面                           │
│          │                                             │
│ 💬 新規   │ 🤖 EleKnowledge-AIへようこそ！               │
│          │    技術資料を検索して質問にお答えします       │
│ 📚 履歴   │                                             │
│ session1 │ 👤 ユーザー: ○○の配線方法は？               │
│ session2 │                                             │
│ session3 │ 🤖 AI: ○○の配線方法は以下の通りです...      │
│          │    📄 配線マニュアルv2.pdf                   │
│ 🔍 検索   │    📄 技術仕様書.pdf                         │
│ フィルター │    👍 👎                                    │
│          │                                             │
│           │ 💬 質問を入力... [送信]                     │
│           │                                             │
└──────────┴──────────────────────────────────────────────┘
```

**機能詳細:**

##### チャットインターフェース
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: string[];
  sourceDocuments?: SourceDocument[];
  feedback?: 'good' | 'bad' | null;
}

interface SourceDocument {
  documentName: string;
  sourceUri: string;
  documentType: string;
  product: string;
  model: string;
}
```

##### セッション管理
```typescript
interface ChatSession {
  sessionId: string;
  title: string;
  createdAt: string;
  lastMessageTime: string;
  messageCount: number;
  messages: ChatMessage[];
}
```

##### メタデータフィルター
```typescript
interface SearchFilters {
  documentType?: 'manual' | 'policy' | 'report' | 'specification';
  product?: string;
  model?: string;
  category?: string;
}
```

#### 3.2.2 Knowledge Base設定

**構成:**
- **Knowledge Base ID:** KB_ELEKNOWLEDGE_001
- **Embedding Model:** Amazon Titan Embeddings G1
- **Vector Database:** OpenSearch Serverless
- **データソース:** S3バケット (eleknowledge-documents)

**ドキュメント構造:**
```
s3://eleknowledge-documents/
├── C-manual/
├── D-manual/
├── EA-manual/
├── GM/
├── Installation-Notebooks/
├── Installation-Standards/
├── S-manual
└── yellow-book
```

**メタデータスキーマ:**
```json
{
  "metadataAttributes": {
    "title": {
      "value": {
        "type": "STRING",
        "stringValue": "三菱エレベーター AXIEZ-LINKs P形"
      },
      "includeForEmbedding": true
    },
    "document": {
      "value": {
        "type": "STRING",
        "stringValue": "C資料"
      },
      "includeForEmbedding": true
    },
    "product": {
      "value": {
        "type": "STRING",
        "stringValue": "エレベーター"
      },
      "includeForEmbedding": true
    },
    "model": {
      "value": {
        "type": "STRING",
        "stringValue": "KE-LG"
      },
      "includeForEmbedding": true
    },
    "control-system": {
      "value": {
        "type": "STRING",
        "stringValue": "VFGLF"
      },
      "includeForEmbedding": true
    },
    "keywords": {
      "value": {
        "type": "STRING_LIST",
        "stringListValue": [
          "AXIEZ-LINKs",
          "P形",
          "据付場用図",
          "機械部分",
          "標準図",
          "巻上機",
          "調速機",
          "非常止め",
          "ガイドシュー",
          "ドア装置",
          "釣合オモリ",
          "レール",
          "緩衝器",
          "ロープ掛け"
        ]
      },
      "includeForEmbedding": true
    },
    "description": {
      "value": {
        "type": "STRING",
        "stringValue": "AXIEZ-LINKs P形エレベーター（KE-LG/KE-LGM：P7～15）のVFGLF方式における据付場用標準図の機種別表。機械部分の据付調整に必要な図面番号と仕様を網羅した技術資料。"
      },
      "includeForEmbedding": true
    }
  }
}
```

#### 3.2.3 RAG処理フロー

**処理ステップ:**
```
1. ユーザー質問入力
   ↓
2. 入力検証・サニタイゼーション
   ↓
3. セッション管理
   ├─ 新規セッション: タイトル生成
   └─ 既存セッション: 履歴取得
   ↓
4. メタデータフィルター適用
   ↓
5. Knowledge Base検索（ベクトル検索）
   ├─ Top 10件の関連文書取得
   ↓
6. Claude 4による回答生成
   ├─ プロンプト: システム指示 + 検索結果 + 履歴 + 質問
   ├─ Temperature: 0.3（安定性重視）
   └─ Max tokens: 4096
   ↓
7. 引用情報抽出
   ├─ 文書名
   ├─ 文書URI
   ↓
8. DynamoDB保存
   ├─ ユーザーメッセージ
   └─ AIメッセージ（引用付き）
   ↓
9. フロントエンド表示
   ├─ 回答テキスト
   ├─ 引用文書リスト
   ├─ ダウンロードボタン
   └─ フィードバックボタン
```

**プロンプトテンプレート:**
```
System Prompt:
あなたはEleKnowledge-AIの技術サポートアシスタントです。
電気設備・機械設備に関する専門知識を持ち、以下の資料を参照して正確に回答します。

【参照資料】
$search_results$

【チャット履歴】
$chat_history$

【回答ルール】
1. 必ず参照資料に基づいて回答する
2. 引用元の文書名を明記する
3. 不明な点は推測せず「資料に記載がありません」と答える
4. 安全に関わる情報は特に正確性を重視する
5. 技術用語は正確に使用する

ユーザーの質問: $user_query$
```

### 3.3 Phase 3: 新機能開発（3ヶ月）

#### 3.3.1 トラブルシューティング機能

**目的:**
現場で発生したトラブルに対して、過去の事例と技術資料から原因分析と対処方法を提案

**入力情報:**
```typescript
interface TroubleshootingInput {
  siteNumber: string;        // 現場番号
  troubleDescription: string; // トラブル内容
  equipmentModel?: string;    // 機器型番
  symptom?: string;          // 症状
  errorCode?: string;        // エラーコード
  photos?: File[];           // 現場写真
}
```

**処理フロー:**
```
1. ユーザー入力（現場番号、トラブル内容）
   ↓
2. Bedrock Agent（メインオーケストレーター）起動
   ↓
3. Action Group 1: DB検索Lambda実行
   ├─ 現場番号から仕様データ取得
   │   └─ DynamoDB/RDS: sites テーブル
   ├─ 機器型番、設置環境、メンテナンス履歴
   └─ 過去のトラブル履歴
   ↓
4. Knowledge Base検索
   ├─ セマンティック検索で類似トラブル事例抽出
   │   └─ フィルター: document-type = "trouble-case"
   ├─ 関連技術資料の検索
   │   └─ フィルター: product = {該当製品}
   └─ トラブルシューティングマニュアル
   ↓
5. Claude 4による統合分析
   ├─ 入力情報の整理
   ├─ 類似事例との比較
   ├─ 原因推定（優先度順）
   └─ 対処方法の提案（ステップバイステップ）
   ↓
6. 結果出力
   ├─ トラブル分析サマリー
   ├─ 考えられる原因（Top 3）
   ├─ 推奨対処方法
   ├─ 参照資料
   └─ エスカレーション判断
```

**Bedrock Agent設定:**
```json
{
  "agentName": "troubleshooting-agent",
  "description": "現場トラブルの原因分析と対処方法提案",
  "foundationModel": "anthropic.claude-sonnet-4-20250514-v1:0",
  "instruction": "あなたは電気設備のトラブルシューティング専門家です...",
  "actionGroups": [
    {
      "actionGroupName": "db-search",
      "description": "現場情報とトラブル履歴の検索",
      "lambdaArn": "arn:aws:lambda:us-east-1:ACCOUNT_ID:function:db-search-lambda"
    }
  ],
  "knowledgeBases": [
    {
      "knowledgeBaseId": "KB_ELEKNOWLEDGE_001",
      "description": "技術資料とトラブル事例データベース"
    }
  ]
}
```

**DB検索Lambda (db-search-lambda):**
```python
def lambda_handler(event, context):
    """
    Bedrock Agentから呼び出されるAction Group
    現場情報とトラブル履歴を検索
    """
    parameters = event['parameters']
    site_number = parameters[0]['value']
    
    # DynamoDBから現場情報取得
    site_info = get_site_info(site_number)
    
    # トラブル履歴取得
    trouble_history = get_trouble_history(site_number)
    
    return {
        'response': {
            'actionGroup': 'db-search',
            'function': 'get_site_info',
            'functionResponse': {
                'responseBody': {
                    'TEXT': {
                        'body': json.dumps({
                            'site_info': site_info,
                            'trouble_history': trouble_history
                        }, ensure_ascii=False)
                    }
                }
            }
        }
    }
```

**出力フォーマット:**
```typescript
interface TroubleshootingResult {
  analysisId: string;
  siteNumber: string;
  timestamp: string;
  
  // トラブル分析
  analysis: {
    summary: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    estimatedCause: string[];
  };
  
  // 原因候補
  possibleCauses: Array<{
    cause: string;
    probability: number;
    evidence: string[];
    referenceDocuments: string[];
  }>;
  
  // 対処方法
  solutions: Array<{
    step: number;
    action: string;
    caution: string;
    estimatedTime: string;
    requiredTools: string[];
  }>;
  
  // 参照資料
  references: Array<{
    documentName: string;
    documentType: string;
    relevance: number;
  }>;
  
  // エスカレーション判断
  escalation: {
    required: boolean;
    reason?: string;
    department?: string;
  };
}
```

**UI画面:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔧 トラブルシューティング                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 現場番号: [___________]  [検索]                         │
│                                                         │
│ トラブル内容:                                            │
│ ┌─────────────────────────────────────────────────┐     │
│ │                                                 │     │
│ │                                                 │     │
│ └─────────────────────────────────────────────────┘     │
│                                                         │
│ 機器型番: [___________]                                 │
│ エラーコード: [___________]                             │
│                                                         │
│ 📷 現場写真をアップロード [ファイル選択]                 │
│                                                         │
│                          [分析開始]                      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ 📊 分析結果                                              │
│                                                         │
│ ✅ トラブル分析サマリー                                  │
│ 電源ユニットの故障が疑われます。                         │
│ 重要度: 🔴 高                                           │
│                                                         │
│ 🔍 考えられる原因（確率順）                              │
│ 1. ヒューズ断線（70%）                                  │
│    📄 メンテナンスマニュアル p.42                        │
│ 2. 過電流保護回路の誤作動（20%）                         │
│    📄 トラブル事例集 #123                               │
│ 3. 接触不良（10%）                                      │
│                                                         │
│ 🛠️ 推奨対処方法                                          │
│ Step 1: 電源を切断する [重要] (5分)                     │
│ Step 2: ヒューズを点検する (10分)                       │
│ Step 3: テスターで導通確認 (5分)                        │
│                                                         │
│ ⚠️ エスカレーション: 不要                                │
│                                                         │
│ [レポートダウンロード] [履歴に保存]                      │
└─────────────────────────────────────────────────────────┘
```

#### 3.3.2 品質書類チェック機能

**目的:**
技評（技術評価）写真を解析し、仕様データと照合して良否判定を行う

**入力情報:**
```typescript
interface QualityCheckInput {
  siteNumber: string;         // 現場番号
  checkType: string;          // 検査種別
  photos: File[];             // 技評写真（複数枚）
  inspector?: string;         // 検査者名
  checkDate?: string;         // 検査日
}
```

**処理フロー:**
```
1. ユーザー入力（現場番号、技評写真アップロード）
   ↓
2. Bedrock Agent起動
   ↓
3. Action Group 1: DB検索Lambda
   ├─ 現場番号から仕様データ取得
   │   └─ DynamoDB/RDS: specifications テーブル
   ├─ 検査基準値
   ├─ 許容範囲
   └─ 必須チェック項目
   ↓
4. Action Group 2: 画像処理Lambda
   ├─ S3に画像アップロード（一時保存）
   ├─ Claude 4 Vision APIで画像解析
   │   ├─ OCR: 文字情報抽出
   │   ├─ 計測器の数値読み取り
   │   ├─ 調整者・検査者の署名確認
   │   └─ 計測器管理番号の読み取り
   ├─ データ成形（構造化）
   └─ 画像品質チェック
       ├─ 解像度確認
       ├─ 判読可能性
       └─ 撮影角度
   ↓
5. Claude 4による判定ロジック
   ├─ 仕様データと測定値の照合
   │   ├─ 許容範囲内チェック
   │   └─ 異常値検出
   ├─ 書類の完全性チェック
   │   ├─ 必須項目の記入有無
   │   ├─ 署名・捺印の有無
   │   └─ 計測器の有効期限
   ├─ 良否判定
   │   ├─ 合格 (Pass)
   │   ├─ 条件付き合格 (Pass with Notes)
   │   └─ 不合格 (Fail)
   └─ 判定根拠の生成
   ↓
6. 結果出力
   ├─ 良否判定結果
   ├─ 判定根拠（詳細）
   ├─ 抽出データ（調整者、検査者、計測器番号等）
   ├─ 指摘事項（不合格の場合）
   └─ 参考情報
```

> **注:** Phase 3の詳細仕様（トラブルシューティング、品質書類チェック）は、Phase 2実装完了後に改めて策定します。現時点では概要のみ記載しています。

---

## 4. 技術スタック

### 4.1 フロントエンド

| カテゴリ | 技術 | バージョン | 用途 |
|---------|------|-----------|------|
| Framework | Next.js | 14.x | App Router、SSR/SSG |
| UI Library | React | 18.x | コンポーネント開発 |
| スタイリング | Tailwind CSS | 3.x | ユーティリティファースト |
| UI Components | shadcn/ui | latest | 再利用可能コンポーネント |
| 状態管理 | Zustand | 4.x | 軽量状態管理 |
| フォーム | React Hook Form | 7.x | フォーム検証 |
| HTTP Client | Axios | 1.x | API通信 |
| 認証 | AWS Amplify | 6.x | Cognito統合 |

### 4.2 バックエンド

| カテゴリ | 技術 | バージョン | 用途 |
|---------|------|-----------|------|
| Lambda Runtime | Python | 3.11 | RAG処理、DB操作 |
| Lambda Runtime | Node.js | 18.x | 認証処理 |
| API Gateway | REST API | v1 | APIエンドポイント |
| 認証 | AWS Cognito | - | ユーザー管理 |
| パッケージ管理 | pip / npm | - | 依存関係管理 |

### 4.3 AI/ML

| カテゴリ | 技術 | モデル | 用途 |
|---------|------|--------|------|
| LLM | Amazon Bedrock | Claude 4 Sonnet | RAG応答生成 |
| Embedding | Amazon Bedrock | Titan Embeddings G1 | ベクトル化 |
| Vector DB | OpenSearch Serverless | - | Knowledge Base |
| Multi-Agent | Bedrock Agent | - | 複雑タスク処理（Phase 3） |

### 4.4 インフラ

| カテゴリ | サービス | 用途 |
|---------|---------|------|
| ホスティング | AWS Amplify | フロントエンド配信 |
| セキュリティ | AWS WAF | IP制限、攻撃防御 |
| データベース | DynamoDB | ユーザー、チャット履歴 |
| ストレージ | S3 | ドキュメント保存 |
| シークレット | Secrets Manager | API Key管理 |
| ログ | CloudWatch Logs | ログ集約 |
| 監視 | CloudWatch | メトリクス、アラート |

---

## 5. セキュリティ

### 5.1 認証・認可

**認証方式:**
- AWS Cognito User Pool
- JWT（JSON Web Token）ベース
- Access Token（1時間）+ Refresh Token（30日）

**認可:**
- API Gateway Cognito Authorizer
- Lambdaでユーザー権限チェック
- リソースベースのアクセス制御

### 5.2 データ暗号化

**転送時の暗号化:**
- すべての通信はHTTPS（TLS 1.2以上）
- API Gateway → Lambda: AWS内部通信（暗号化済み）

**保管時の暗号化:**
- DynamoDB: AWS管理キー（デフォルト暗号化）
- S3: SSE-S3（サーバーサイド暗号化）
- Secrets Manager: AWS KMS暗号化

### 5.3 ネットワークセキュリティ

**VPC構成:**
- Private Subnet内にLambda配置
- NAT Gateway経由で外部API接続
- Security Groupで通信制限

**IP制限:**
- AWS WAF IP Set: 192.168.28.0/24
- 社内ネットワークからのみアクセス可能

### 5.4 環境変数管理

**機密情報の保護:**
- すべての機密情報は`.env`ファイルで管理
- `.env`は`.gitignore`に記載（Git管理外）
- 本番環境はAWS Secrets Managerで管理

**環境変数の種類:**
```bash
# AWS設定
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=xxxxx

# Cognito
COGNITO_USER_POOL_ID=xxxxx
COGNITO_CLIENT_ID=xxxxx

# Bedrock
BEDROCK_KB_ID=xxxxx
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-xxxxx

# DynamoDB
DYNAMODB_USERS_TABLE=eleknowledge-users
DYNAMODB_CHATLOGS_TABLE=eleknowledge-chatlogs

# S3
S3_DOCUMENTS_BUCKET=eleknowledge-documents
```

### 5.5 入力検証

**バックエンド検証:**
- すべてのユーザー入力をサニタイゼーション
- XSS対策: HTMLエスケープ
- SQLインジェクション対策: パラメータ化クエリ（DynamoDB）
- 入力長制限: 最大文字数制限

**フロントエンド検証:**
- React Hook Formでバリデーション
- 型安全性（TypeScript）
- CSRFトークン（必要に応じて）

---

## 6. データモデル

### 6.1 DynamoDB テーブル設計

#### 6.1.1 users テーブル

```typescript
{
  userId: string;           // Partition Key (Cognito Sub)
  email: string;            // Email
  username: string;         // ユーザー名
  createdAt: string;        // 作成日時（ISO 8601）
  lastLoginAt: string;      // 最終ログイン
  role: 'admin' | 'user';   // ロール
}
```

#### 6.1.2 eleknowledge-chatlogs テーブル

```typescript
{
  sessionId: string;        // Partition Key
  messageId: string;        // Sort Key (ULID)
  userId: string;           // ユーザーID（GSI）
  role: 'user' | 'assistant';
  content: string;          // メッセージ内容
  timestamp: string;        // タイムスタンプ
  citations?: string[];     // 引用（AIのみ）
  sourceDocuments?: object[]; // ソース文書
  feedback?: string;        // フィードバック
  ttl: number;              // TTL（30日後削除）
}
```

**GSI (Global Secondary Index):**
- userId-timestamp-index: ユーザーごとの履歴取得

### 6.2 S3 バケット構成

#### 6.2.1 eleknowledge-documents（Knowledge Base用）

```
eleknowledge-documents/
├── manuals/              # マニュアル
├── policies/             # 規定・ポリシー
├── reports/              # 報告書
└── specifications/       # 仕様書
```

#### 6.2.2 eleknowledge-uploads（一時アップロード用）

```
eleknowledge-uploads/
├── tmp/                  # 一時ファイル（24時間で削除）
└── processed/            # 処理済みファイル
```

### 6.3 データライフサイクル管理

#### チャット履歴の保管期間

**ポリシー:**
- 保管期間: 最終更新から**30日間**
- 自動削除: DynamoDB TTL機能で実装
- UI表示: 各セッションに残り日数を表示

**実装:**
```python
# TTL設定（メッセージ保存時）
ttl_timestamp = int(time.time()) + (30 * 24 * 60 * 60)  # 30日後

item = {
    'sessionId': session_id,
    'messageId': message_id,
    'content': content,
    'timestamp': datetime.now().isoformat(),
    'ttl': ttl_timestamp  # TTL属性
}
```

**UI表示例:**
```typescript
// 残り日数の計算と表示
const daysUntilDeletion = calculateDaysUntilDeletion(session.ttl);
// "あと15日で削除されます"
```

#### S3 ドキュメントのライフサイクル

**ライフサイクルポリシー:**
- 30日: Standard → Glacier（アーカイブ）
- 90日: Glacier → Deep Archive
- 1年: 削除（ポリシーに基づく）

**一時ファイル:**
- tmp/ 配下: 24時間で自動削除

#### 削除通知

**通知設定:**
- 削除7日前: メール通知（オプション）
- 削除1日前: UI内通知バナー表示

---

## 7. API仕様

### 7.1 認証API

**Base URL:** `https://xxxxx.execute-api.us-east-1.amazonaws.com/prod`

#### POST /auth/signup
ユーザー登録

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "message": "確認コードをメールに送信しました",
  "userId": "xxxxx"
}
```

#### POST /auth/login
ログイン

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "accessToken": "eyJxx...",
  "refreshToken": "eyJxx...",
  "idToken": "eyJxx...",
  "expiresIn": 3600
}
```

### 7.2 RAG処理API

**Base URL:** `https://yyyyy.execute-api.us-east-1.amazonaws.com/prod`

#### POST /rag/query
RAGクエリ実行

**Request:**
```json
{
  "sessionId": "session_xxxxx",
  "query": "配線の接続方法は？",
  "filters": {
    "documentType": "manual",
    "product": "ProductA"
  }
}
```

**Response:**
```json
{
  "messageId": "msg_xxxxx",
  "content": "配線の接続方法は...",
  "citations": ["doc1.pdf", "doc2.pdf"],
  "sourceDocuments": [
    {
      "documentName": "配線マニュアルv2.pdf",
      "sourceUri": "s3://...",
      "relevance": 0.95
    }
  ],
  "timestamp": "2025-10-02T21:30:00Z"
}
```

### 7.3 チャット管理API

**Base URL:** `https://zzzzz.execute-api.us-east-1.amazonaws.com/prod`

#### GET /chat/sessions
セッション一覧取得

**Response:**
```json
{
  "sessions": [
    {
      "sessionId": "session_xxxxx",
      "title": "配線に関する質問",
      "createdAt": "2025-10-01T10:00:00Z",
      "lastMessageTime": "2025-10-02T15:30:00Z",
      "messageCount": 12,
      "daysUntilDeletion": 28
    }
  ]
}
```

### 7.4 エラーハンドリング戦略

#### バックエンドエラー分類

**1. システムエラー (500系)**
- Lambda実行エラー → CloudWatch Logs記録
- Bedrock API障害 → 3回リトライ（指数バックオフ: 1s, 2s, 4s）
- DynamoDB接続エラー → SDK自動リトライ

**2. ビジネスエラー (400系)**
- 入力検証エラー → 400 Bad Request
- 認証エラー → 401 Unauthorized
- 認可エラー → 403 Forbidden
- リソース上限 → 429 Too Many Requests

#### 統一エラーレスポンス形式

```typescript
interface ErrorResponse {
  error: string;           // エラー種別
  message: string;         // ユーザー向けメッセージ
  code: string;            // エラーコード
  timestamp: string;       // ISO 8601
  requestId?: string;      // トレーシング用
}
```

**例:**
```json
{
  "error": "ValidationError",
  "message": "入力内容を確認してください",
  "code": "INVALID_INPUT",
  "timestamp": "2025-10-02T21:30:00Z",
  "requestId": "req-xxxxx"
}
```

#### フロントエンドエラー表示

```typescript
interface ErrorDisplay {
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  recoverable: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
}
```

**表示例:**
- "⚠️ 接続エラー - ネットワークを確認してください [再試行]"
- "❌ セッション期限切れ - 再度ログインしてください [ログイン画面へ]"

### 7.5 API Gateway スロットリング設定

**想定負荷:**
- 同時接続: 20人
- 登録ユーザー: 100人
- 平均クエリ: 10件/人/日 = 1,000件/日 = 約40件/時

**スロットリング設定:**

| API | バースト | 定常レート | 用途 |
|-----|---------|-----------|------|
| 認証API | 50 req/sec | 10 req/sec | ログイン・認証 |
| RAG処理API | 20 req/sec | 5 req/sec | RAGクエリ |
| チャット管理API | 50 req/sec | 10 req/sec | 履歴取得 |

**WAF レート制限:**
- IPベース: 500 req/5min（社内IP全体）
- ユーザーベース: 100 req/5min（1ユーザー）

---

## 8. デプロイ構成

### 8.1 AWSリージョン戦略

**プライマリリージョン:** us-east-1（米国東部バージニア北部）

**選定理由:**
1. ✅ Bedrock Claude 4の最新機能が最初に利用可能
2. ✅ 新サービス・機能の提供が最速
3. ✅ サービス障害時のAWSサポートが最も充実
4. ✅ コスト面で有利（一部サービス）

**考慮事項:**
- ⚠️ レイテンシー: 日本から約150ms（許容範囲内）
- ⚠️ データレジデンシー: 社内データが米国に保存
- ⚠️ コンプライアンス: 法的要件確認済み

**将来的な拡張:**
- マルチリージョン展開は当面予定なし
- DR（災害復旧）は同リージョン内AZ冗長化で対応

### 8.2 環境構成

| 環境 | 用途 | URL | ブランチ |
|-----|------|-----|---------|
| Development | 開発・テスト | dev.eleknowledge-ai.amplifyapp.com | develop |
| Production | 本番 | eleknowledge-ai.amplifyapp.com | main |

### 8.3 CI/CD

**Amplify Hosting自動デプロイ:**
1. Gitプッシュ検知
2. ビルド実行（Next.js build）
3. テスト実行
4. デプロイ（成功時のみ）
5. 通知（Slack）

**Lambda デプロイ:**
- AWS SAM / Serverless Framework
- GitHub Actions経由でデプロイ
- Blue/Green デプロイ（本番）

### 8.4 インフラ as Code

**使用ツール:**
- AWS CloudFormation
- AWS SAM
- Terraform（検討中）

### 8.5 コスト試算

**月間想定コスト（20人同時接続、100人登録、1日平均10クエリ）**

| サービス | 項目 | 想定使用量 | 月額概算（USD） |
|---------|------|-----------|----------------|
| **AI/ML** |
| Bedrock Claude 4 | 入力トークン | 60万トークン | $1.80 |
| Bedrock Claude 4 | 出力トークン | 20万トークン | $3.00 |
| Knowledge Base | ベクトル検索 | 6,000クエリ | $3.00 |
| **データベース** |
| DynamoDB | 読み込み | 2万RCU | $2.50 |
| DynamoDB | 書き込み | 6,000WCU | $3.00 |
| **ホスティング** |
| Amplify Hosting | ビルド・配信 | 20GB転送 | $3.00 |
| **コンピューティング** |
| Lambda | 実行時間 | 2万GB-秒 | $0.33 |
| API Gateway | リクエスト | 2万リクエスト | $0.07 |
| **セキュリティ** |
| WAF | 基本+ルール | 5ルール | $10.00 |
| WAF | リクエスト | 2万リクエスト | $0.01 |
| **ストレージ** |
| S3 | ストレージ | 10GB | $0.23 |
| **その他** |
| CloudWatch | ログ・メトリクス | 標準 | $2.00 |
| **合計** | | | **$28.94/月** |

**年間コスト:** 約**$347（約48,000円）**

**コスト最適化施策:**
1. DynamoDB On-Demand → Provisioned（安定稼働後）
2. Lambda予約済みキャパシティ（高頻度実行時）
3. S3 Intelligent-Tiering活用
4. CloudWatch Logs保管期間最適化

---

## 9. 開発ロードマップ

### 9.1 Phase 1: 基盤整備

**目標:** 認証基盤とホスト環境の構築

**タスク:**
- [ ] AWS環境セットアップ
  - [ ] Cognito User Pool作成
  - [ ] DynamoDBテーブル作成
  - [ ] S3バケット作成
- [ ] 認証機能実装
  - [ ] サインアップ機能
  - [ ] ログイン機能
  - [ ] パスワードリセット
- [ ] フロントエンド基盤
  - [ ] Next.js プロジェクトセットアップ
  - [ ] Amplify Hosting設定
  - [ ] WAF設定（IP制限）
- [ ] ホーム画面実装
  - [ ] レイアウト作成
  - [ ] ナビゲーション
  - [ ] 機能カード表示

**マイルストーン:**
- Week 4: 認証機能完成
- Week 8: Phase 1完了、Phase 2開始

### 9.2 Phase 2: RAGチャット機能

**目標:** RAGチャットの完全実装

**タスク:**
- [ ] Knowledge Base構築
  - [ ] S3にドキュメントアップロード
  - [ ] メタデータ設定
  - [ ] Knowledge Base作成・同期
- [ ] RAG Lambda実装
  - [ ] Bedrock SDK統合
  - [ ] Knowledge Base検索実装
  - [ ] Claude 4応答生成
- [ ] チャット管理Lambda実装
  - [ ] DynamoDB CRUD操作
  - [ ] セッション管理
  - [ ] TTL設定
- [ ] フロントエンド実装
  - [ ] チャット画面UI
  - [ ] リアルタイムメッセージ表示
  - [ ] 引用文書表示
  - [ ] フィードバック機能
  - [ ] フィルター機能

**マイルストーン:**
- Week 12: Knowledge Base完成
- Week 14: RAG Lambda完成
- Week 16: Phase 2完了、Phase 3開始

### 9.3 Phase 3: 新機能開発

**Phase 2完了後に詳細策定**

**概要:**
- トラブルシューティング機能
- 品質書類チェック機能（Claude 4 Vision API）
- Bedrock Agent統合

### 9.4 マイルストーン

| Phase | 期間 | 完了時期 | 主要成果物 |
|-------|------|---------|-----------|
| Phase 1 | 2ヶ月 | 2025年12月 | 認証基盤、ホーム画面 |
| Phase 2 | 2ヶ月 | 2026年2月 | RAGチャット機能 |
| Phase 3 | 3ヶ月 | 2026年5月 | 新機能（トラブル、品質） |

### 9.5 テスト戦略

#### Phase 1テスト項目

**単体テスト:**
- [ ] 認証Lambda関数（Jest）
- [ ] フロントエンドコンポーネント（React Testing Library）

**統合テスト:**
- [ ] Cognito認証フロー E2E
- [ ] API Gateway → Lambda連携

**セキュリティテスト:**
- [ ] WAF IP制限テスト
- [ ] 認証バイパステスト
- [ ] XSS/CSRF対策確認

#### Phase 2テスト項目

**単体テスト:**
- [ ] RAG Lambda（Pytest + mock Bedrock）
- [ ] チャット管理Lambda
- [ ] チャット画面コンポーネント

**統合テスト:**
- [ ] Knowledge Base検索テスト
- [ ] RAG処理フロー E2E
- [ ] セッション管理・履歴取得

**パフォーマンステスト:**
- [ ] 同時接続20ユーザー負荷テスト
- [ ] レスポンスタイム < 3秒
- [ ] Knowledge Base検索 < 1秒

**UAT（User Acceptance Test）:**
- [ ] 技術者3名による実地テスト
- [ ] フィードバック収集・改善

---

## 10. 運用・保守

### 10.1 バックアップ戦略

#### DynamoDB バックアップ

**PITR (Point-in-Time Recovery):**
- 有効化: 全テーブル
- 保管期間: 35日間
- RTO目標: 4時間

**オンデマンドバックアップ:**
- 頻度: 週次（日曜深夜）
- 保管: S3 Cross-Region Replication
- 保管期間: 90日

#### S3 バックアップ

**バージョニング:**
- eleknowledge-documents: 有効化
- 誤削除防止

**ライフサイクル:**
- 30日後 → Glacier
- 1年後 → Glacier Deep Archive

#### RTO/RPO目標

| メトリクス | 目標値 | 説明 |
|-----------|--------|------|
| RTO | 4時間 | 復旧時間目標 |
| RPO | 24時間 | データ損失許容時間 |

### 10.2 災害復旧（DR）

**戦略:**
- 同一リージョン内でAZ冗長化
- マルチAZ配置（Lambda、DynamoDB）
- S3自動レプリケーション

**復旧手順書:**
1. 障害検知（CloudWatch Alarm）
2. 影響範囲の特定
3. バックアップからの復元
4. 動作確認テスト
5. サービス再開
6. ポストモーテム作成

### 10.3 監視・アラート

#### CloudWatch ダッシュボード

**主要メトリクス:**
- Lambda実行時間（p50, p90, p99）
- Lambda エラー率
- API Gateway レイテンシー
- DynamoDB スロットリング
- Bedrock APIコール数・エラー
- WAF ブロック数

#### アラート設定

| メトリクス | 閾値 | アクション | 通知先 |
|-----------|------|-----------|--------|
| Lambda エラー率 | 5%以上 | Email通知 | 開発チーム |
| API Gateway 5xx | 10回/5分 | Email通知 | 開発チーム |
| Bedrock タイムアウト | 3回連続 | Email通知 | 開発チーム |
| DynamoDB スロットリング | 発生時 | Email通知 | インフラ担当 |
| WAF ブロック | 100回/時 | Email通知 | セキュリティ担当 |

#### ログ保管

**CloudWatch Logs:**
- 保管期間: 30日
- ログレベル: INFO（本番）、DEBUG（開発）

**S3アーカイブ:**
- 保管期間: 90日
- Glacier移行: 30日後

**セキュリティログ:**
- 保管期間: 3年（コンプライアンス要件）
- 改ざん防止: S3 Object Lock

### 10.4 保守スケジュール

#### 定期メンテナンス

| 項目 | 頻度 | 内容 |
|------|------|------|
| 依存パッケージ更新 | 月次 | セキュリティパッチ適用 |
| Knowledge Base再同期 | 週次 | 新規ドキュメント追加 |
| バックアップ検証 | 月次 | 復元テスト |
| セキュリティ監査 | 四半期 | 脆弱性スキャン |
| パフォーマンステスト | 四半期 | 負荷テスト |

#### インシデント対応

**レベル定義:**
- **Critical:** サービス停止、データ損失
- **High:** 一部機能停止、大幅な性能低下
- **Medium:** 軽微な機能障害
- **Low:** UI/UX改善要望

**対応時間:**
- Critical: 即座（24時間対応）
- High: 4時間以内
- Medium: 1営業日以内
