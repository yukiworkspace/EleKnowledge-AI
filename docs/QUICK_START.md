# 🚀 クイックスタートガイド

## AWS CLI & SAM CLI インストール（Windows）

### ステップ1: AWS CLI v2 インストール

#### 1.1 インストーラーのダウンロード

PowerShellで以下を実行してインストーラーをダウンロード：

```powershell
# ダウンロードディレクトリに移動
cd $env:USERPROFILE\Downloads

# AWS CLI v2インストーラーをダウンロード
Invoke-WebRequest -Uri "https://awscli.amazonaws.com/AWSCLIV2.msi" -OutFile "AWSCLIV2.msi"
```

または、ブラウザで以下のURLを開いてダウンロード：
```
https://awscli.amazonaws.com/AWSCLIV2.msi
```

#### 1.2 インストーラーの実行

```powershell
# MSIインストーラーを実行
Start-Process msiexec.exe -Wait -ArgumentList '/i AWSCLIV2.msi /quiet'
```

または、ダウンロードした`AWSCLIV2.msi`をダブルクリックしてインストール。

#### 1.3 インストール確認

**重要: PowerShellを再起動してください！**

```powershell
# PowerShellを閉じて、新しいPowerShellウィンドウを開く
# その後、以下を実行

aws --version
```

**期待される出力例:**
```
aws-cli/2.15.x Python/3.11.x Windows/10 exe/AMD64
```

---

### ステップ2: AWS SAM CLI インストール

#### 2.1 インストーラーのダウンロード

```powershell
# ダウンロードディレクトリに移動
cd $env:USERPROFILE\Downloads

# 最新バージョンを確認してダウンロード
# ブラウザで以下を開く
Start-Process "https://github.com/aws/aws-sam-cli/releases/latest"
```

または、直接ダウンロード：
```powershell
# 最新のSAM CLIインストーラーをダウンロード
Invoke-WebRequest -Uri "https://github.com/aws/aws-sam-cli/releases/latest/download/AWS_SAM_CLI_64_PY3.msi" -OutFile "AWS_SAM_CLI_64_PY3.msi"
```

#### 2.2 インストーラーの実行

```powershell
# MSIインストーラーを実行
Start-Process msiexec.exe -Wait -ArgumentList '/i AWS_SAM_CLI_64_PY3.msi /quiet'
```

または、ダウンロードした`AWS_SAM_CLI_64_PY3.msi`をダブルクリック。

#### 2.3 インストール確認

**PowerShellを再起動してください！**

```powershell
sam --version
```

**期待される出力例:**
```
SAM CLI, version 1.110.x
```

---

### ステップ3: AWS認証情報設定

#### 3.1 AWSアクセスキーの準備

AWSマネジメントコンソールでアクセスキーを発行：

1. AWS Console → IAM → Users → ユーザーを選択
2. "Security credentials" タブ
3. "Create access key" をクリック
4. アクセスキーIDとシークレットアクセスキーをコピー

#### 3.2 プロファイル設定

```powershell
# 開発用プロファイルを設定
aws configure --profile eleknowledge-dev
```

以下を入力：
```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: us-east-1
Default output format [None]: json
```

#### 3.3 認証確認

```powershell
# 認証情報確認
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

---

### ステップ4: プロジェクトセットアップ

#### 4.1 プロジェクトディレクトリに移動

```powershell
cd C:\Users\$env:USERNAME\devspace
```

#### 4.2 Git確認

```powershell
git status
```

#### 4.3 環境変数ファイル作成

```powershell
# .env.exampleをコピーして.envを作成
Copy-Item .env.example .env

# .envファイルを編集
notepad .env
```

---

### ステップ5: Phase 1デプロイ

#### 5.1 デプロイスクリプト実行

```powershell
# Phase 1をデプロイ
.\infrastructure\scripts\setup-phase1.ps1 -Profile eleknowledge-dev -Environment development
```

#### 5.2 デプロイ結果確認

スクリプトが表示する環境変数を`.env`ファイルにコピー：

```bash
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
# ... その他
```

---

## トラブルシューティング

### 問題1: 「aws コマンドが見つかりません」

**原因:** PATHが設定されていない、またはPowerShellを再起動していない

**解決方法:**
1. PowerShellを閉じる
2. 新しいPowerShellウィンドウを開く
3. 再度 `aws --version` を実行

それでも解決しない場合：

```powershell
# PATHを確認
$env:PATH -split ';' | Select-String "AWS"

# 手動でPATHを追加（管理者権限で実行）
[Environment]::SetEnvironmentVariable(
    "Path",
    $env:Path + ";C:\Program Files\Amazon\AWSCLIV2\",
    [EnvironmentVariableTarget]::Machine
)
```

### 問題2: 「認証エラー」

**原因:** アクセスキーが正しくない

**解決方法:**
```powershell
# 認証情報を再設定
aws configure --profile eleknowledge-dev

# 設定内容確認
aws configure list --profile eleknowledge-dev
```

### 問題3: インストーラーのダウンロード失敗

**原因:** ネットワーク制限、プロキシ設定

**解決方法:**
ブラウザで直接ダウンロード：
- AWS CLI v2: https://awscli.amazonaws.com/AWSCLIV2.msi
- SAM CLI: https://github.com/aws/aws-sam-cli/releases/latest

---

## 次のステップ

1. ✅ AWS CLI & SAM CLI インストール完了
2. ✅ 認証情報設定完了
3. ➡️ **Lambda関数実装** (`lambda/auth/*/app.py`)
4. ➡️ **フロントエンド開発** (Next.js)
5. ➡️ **WAF設定** (AWS Console)
6. ➡️ **Amplify Hosting** (AWS Console)

詳細は以下のドキュメントを参照：
- `docs/aws-cli-setup.md` - 詳細なセットアップガイド
- `docs/deployment-guide.md` - デプロイ手順
- `roadmap.md` - 開発ロードマップ

---

**最終更新:** 2025-10-03  
**作成者:** Development Team
