# 🛠️ AWS CLI セットアップガイド

## 目次

1. [前提条件](#1-前提条件)
2. [AWS CLI v2 インストール](#2-aws-cli-v2-インストール)
3. [AWS SAM CLI インストール](#3-aws-sam-cli-インストール)
4. [認証情報設定](#4-認証情報設定)
5. [動作確認](#5-動作確認)
6. [トラブルシューティング](#6-トラブルシューティング)

---

## 1. 前提条件

### 必要なもの
- Windows 10/11
- Visual Studio Code
- Git for Windows
- PowerShell 5.1 以上
- AWSアカウント
- IAMユーザーのアクセスキー（開発用プロファイル作成済み）

### 必要な権限
開発用IAMユーザーに以下の権限が必要です：
- `AdministratorAccess`（開発環境の場合）
- または以下の個別権限：
  - `AWSCloudFormationFullAccess`
  - `AWSLambda_FullAccess`
  - `AmazonAPIGatewayAdministrator`
  - `AmazonCognitoPowerUser`
  - `AmazonDynamoDBFullAccess`
  - `AmazonS3FullAccess`
  - `IAMFullAccess`
  - `CloudWatchLogsFullAccess`

---

## 2. AWS CLI v2 インストール

### 2.1 インストーラーのダウンロード

**公式サイトからダウンロード:**
```
https://awscli.amazonaws.com/AWSCLIV2.msi
```

### 2.2 インストール実行

1. ダウンロードした `AWSCLIV2.msi` を実行
2. インストールウィザードに従ってインストール
3. デフォルト設定のまま進める

### 2.3 インストール確認

PowerShellで以下を実行：

```powershell
aws --version
```

**期待される出力例:**
```
aws-cli/2.15.x Python/3.11.x Windows/10 exe/AMD64
```

### 2.4 PATH設定確認

インストール後、通常は自動的にPATHに追加されます。

確認方法：
```powershell
$env:PATH -split ';' | Select-String "AWS"
```

手動でPATH追加が必要な場合：
```
C:\Program Files\Amazon\AWSCLIV2\
```

---

## 3. AWS SAM CLI インストール

### 3.1 インストーラーのダウンロード

**公式サイトからダウンロード:**
```
https://github.com/aws/aws-sam-cli/releases/latest/download/AWS_SAM_CLI_64_PY3.msi
```

### 3.2 インストール実行

1. ダウンロードした `AWS_SAM_CLI_64_PY3.msi` を実行
2. インストールウィザードに従ってインストール
3. デフォルト設定のまま進める

### 3.3 インストール確認

PowerShellで以下を実行：

```powershell
sam --version
```

**期待される出力例:**
```
SAM CLI, version 1.110.x
```

---

## 4. 認証情報設定

### 4.1 プロファイル設定確認

開発用プロファイルが既に作成済みとのことですが、以下で確認できます：

```powershell
# プロファイル一覧表示
aws configure list-profiles

# 特定プロファイルの設定確認
aws configure list --profile <プロファイル名>
```

### 4.2 認証情報ファイルの場所

Windows環境での認証情報ファイル：

```
C:\Users\<ユーザー名>\.aws\credentials
C:\Users\<ユーザー名>\.aws\config
```

### 4.3 認証情報ファイルの内容例

#### `credentials` ファイル
```ini
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

[eleknowledge-dev]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE2
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY2
```

#### `config` ファイル
```ini
[default]
region = us-east-1
output = json

[profile eleknowledge-dev]
region = us-east-1
output = json
```

### 4.4 環境変数での設定（オプション）

プロジェクト専用のプロファイルを使用する場合：

```powershell
# 現在のセッションのみ有効
$env:AWS_PROFILE = "eleknowledge-dev"

# または .env ファイルに記載
# AWS_PROFILE=eleknowledge-dev
```

---

## 5. 動作確認

### 5.1 AWS CLI 動作確認

```powershell
# 現在のユーザー情報確認
aws sts get-caller-identity --profile eleknowledge-dev
```

**期待される出力例:**
```json
{
    "UserId": "AIDACKCEVSQ6C2EXAMPLE",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/eleknowledge-dev"
}
```

### 5.2 リージョン確認

```powershell
# 設定されているリージョン確認
aws configure get region --profile eleknowledge-dev
```

**期待される出力:**
```
us-east-1
```

### 5.3 S3アクセス確認（権限テスト）

```powershell
# S3バケット一覧取得
aws s3 ls --profile eleknowledge-dev
```

### 5.4 SAM CLI 動作確認

```powershell
# SAM初期化テスト（テンプレート作成）
sam init --help
```

---

## 6. トラブルシューティング

### 6.1 「aws コマンドが見つかりません」エラー

**原因:** PATHが正しく設定されていない

**解決方法:**
1. PowerShellを管理者権限で再起動
2. 以下のコマンドでPATHを確認：
   ```powershell
   $env:PATH -split ';' | Select-String "AWS"
   ```
3. 見つからない場合、手動で追加：
   ```powershell
   [Environment]::SetEnvironmentVariable(
       "Path",
       $env:Path + ";C:\Program Files\Amazon\AWSCLIV2\",
       [EnvironmentVariableTarget]::Machine
   )
   ```
4. PowerShellを再起動

### 6.2 認証エラー

**エラー例:**
```
An error occurred (UnrecognizedClientException) when calling the XXX operation: 
The security token included in the request is invalid.
```

**原因:** アクセスキーが無効、または期限切れ

**解決方法:**
1. 認証情報ファイルを確認：
   ```powershell
   notepad $env:USERPROFILE\.aws\credentials
   ```
2. AWSコンソールで新しいアクセスキーを発行
3. 認証情報を更新：
   ```powershell
   aws configure --profile eleknowledge-dev
   ```

### 6.3 リージョンエラー

**エラー例:**
```
Could not connect to the endpoint URL
```

**原因:** リージョンが正しく設定されていない

**解決方法:**
```powershell
# リージョンを明示的に指定
aws configure set region us-east-1 --profile eleknowledge-dev

# または環境変数で指定
$env:AWS_DEFAULT_REGION = "us-east-1"
```

### 6.4 権限エラー

**エラー例:**
```
An error occurred (AccessDenied) when calling the XXX operation: 
User: arn:aws:iam::123456789012:user/xxx is not authorized to perform: xxx
```

**原因:** IAMユーザーに必要な権限がない

**解決方法:**
1. AWSコンソールでIAMユーザーの権限を確認
2. 必要な権限ポリシーをアタッチ
3. 権限変更後、数分待ってから再試行

### 6.5 SAM CLI エラー

**エラー例:**
```
Error: PythonPipBuilder:ResolveDependencies - {pip_error_message}
```

**原因:** Pythonランタイムの問題

**解決方法:**
1. Python 3.11がインストールされているか確認：
   ```powershell
   python --version
   ```
2. インストールされていない場合、Python 3.11をインストール：
   ```
   https://www.python.org/downloads/
   ```
3. SAM CLIを再インストール

### 6.6 Docker関連エラー（SAMローカルテスト時）

**エラー例:**
```
Error: Running AWS SAM projects locally requires Docker. Have you got it installed?
```

**原因:** Docker Desktopがインストールされていない、または起動していない

**解決方法:**
1. Docker Desktop for Windowsをインストール：
   ```
   https://www.docker.com/products/docker-desktop
   ```
2. Docker Desktopを起動
3. PowerShellで確認：
   ```powershell
   docker --version
   ```

---

## 7. 推奨設定

### 7.1 PowerShell プロファイル設定

よく使うエイリアスを設定しておくと便利です：

```powershell
# PowerShellプロファイルを編集
notepad $PROFILE
```

**追加する内容:**
```powershell
# EleKnowledge-AI プロジェクト用エイリアス
function Set-EleKnowledgeProfile {
    $env:AWS_PROFILE = "eleknowledge-dev"
    $env:AWS_REGION = "us-east-1"
    Write-Host "✅ AWS Profile set to: eleknowledge-dev" -ForegroundColor Green
    Write-Host "✅ AWS Region set to: us-east-1" -ForegroundColor Green
}
Set-Alias -Name use-eleknowledge -Value Set-EleKnowledgeProfile

# プロジェクトディレクトリへの移動
function Go-EleKnowledge {
    Set-Location "C:\Users\$env:USERNAME\devspace"
    use-eleknowledge
}
Set-Alias -Name cdek -Value Go-EleKnowledge

# AWS CLI ショートカット
Set-Alias -Name awsp -Value 'aws --profile eleknowledge-dev'
```

**使用方法:**
```powershell
# プロファイル設定
use-eleknowledge

# プロジェクトディレクトリへ移動
cdek

# AWS CLI実行（プロファイル指定済み）
awsp s3 ls
```

### 7.2 VSCode設定

`.vscode/settings.json` に以下を追加：

```json
{
  "terminal.integrated.env.windows": {
    "AWS_PROFILE": "eleknowledge-dev",
    "AWS_REGION": "us-east-1"
  },
  "aws.profile": "eleknowledge-dev",
  "aws.region": "us-east-1"
}
```

---

## 8. 次のステップ

セットアップが完了したら、以下のドキュメントを参照してください：

1. **デプロイ手順書** (`docs/deployment-guide.md`)
   - Phase 1のデプロイ方法
   - Phase 2のデプロイ方法

2. **AWSリソース一覧** (`docs/aws-resources.md`)
   - 作成されるAWSリソースの詳細

3. **開発ワークフロー** (`roadmap.md`)
   - 開発の進め方

---

## 参考リンク

- [AWS CLI ユーザーガイド](https://docs.aws.amazon.com/cli/latest/userguide/)
- [AWS SAM Developer Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/)
- [AWS CLI コマンドリファレンス](https://awscli.amazonaws.com/v2/documentation/api/latest/index.html)

---

**最終更新:** 2025-10-03  
**作成者:** Development Team
