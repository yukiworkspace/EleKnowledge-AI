# 🔧 AWS CLI PATH設定ガイド

## 問題: 「aws コマンドが見つかりません」

AWS CLIがインストールされているのにPowerShellで認識されない場合の解決方法です。

---

## 解決方法1: 現在のセッション用（一時的）

**最も簡単な方法 - ただし、PowerShellを閉じると設定が失われます**

```powershell
# 現在のセッションにPATHを追加
$env:Path += ";C:\Program Files\Amazon\AWSCLIV2\"

# 確認
aws --version
```

**期待される出力:**
```
aws-cli/2.31.x Python/3.13.x Windows/11 exe/AMD64
```

---

## 解決方法2: ユーザーレベルで永続的に設定（推奨）

**PowerShellを閉じても設定が保持されます**

```powershell
# ユーザー環境変数のPATHを取得
$userPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)

# AWS CLIのパスを追加
$newPath = $userPath + ";C:\Program Files\Amazon\AWSCLIV2\"

# ユーザー環境変数に設定
[Environment]::SetEnvironmentVariable("Path", $newPath, [EnvironmentVariableTarget]::User)
```

**設定後、PowerShellを再起動して確認:**

```powershell
# 新しいPowerShellウィンドウで実行
aws --version
```

---

## 解決方法3: システムレベルで設定（管理者権限必要）

**すべてのユーザーで有効になります**

```powershell
# PowerShellを管理者として実行
# 右クリック → "管理者として実行"

# システム環境変数のPATHを取得
$systemPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::Machine)

# AWS CLIのパスを追加
$newPath = $systemPath + ";C:\Program Files\Amazon\AWSCLIV2\"

# システム環境変数に設定
[Environment]::SetEnvironmentVariable("Path", $newPath, [EnvironmentVariableTarget]::Machine)
```

**設定後、PowerShellを再起動して確認**

---

## 解決方法4: GUIで設定

### 手順:

1. **Windowsキー + R** を押して「ファイル名を指定して実行」を開く

2. `sysdm.cpl` と入力してEnter

3. **詳細設定** タブをクリック

4. **環境変数** ボタンをクリック

5. **ユーザー環境変数** または **システム環境変数** の `Path` を選択

6. **編集** をクリック

7. **新規** をクリック

8. 以下を追加:
   ```
   C:\Program Files\Amazon\AWSCLIV2\
   ```

9. **OK** をクリックしてすべてのダイアログを閉じる

10. PowerShellを再起動

---

## 確認方法

```powershell
# PATH確認
$env:Path -split ';' | Select-String "AWS"

# AWS CLI動作確認
aws --version

# 設定されているプロファイル確認
aws configure list-profiles
```

---

## よくある問題

### Q1: 設定したのにまだ認識されない

**A:** PowerShellを完全に再起動してください。VSCodeを使っている場合、VSCode自体も再起動が必要です。

### Q2: 管理者権限がない

**A:** 解決方法2（ユーザーレベル）を使用してください。管理者権限は不要です。

### Q3: AWS CLIの実行ファイルがどこにあるか分からない

**A:** 通常は以下の場所です:

```powershell
# 確認コマンド
Get-ChildItem "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
```

---

## PowerShell プロファイルに自動設定を追加（オプション）

毎回PowerShellを開いたときに自動的にPATHを設定：

```powershell
# PowerShellプロファイルを編集
notepad $PROFILE
```

以下を追加:

```powershell
# AWS CLI PATH設定
if (-not ($env:Path -like "*Amazon\AWSCLIV2*")) {
    $env:Path += ";C:\Program Files\Amazon\AWSCLIV2\"
}

# 確認メッセージ（オプション）
if (Get-Command aws -ErrorAction SilentlyContinue) {
    Write-Host "✅ AWS CLI ready: $(aws --version)" -ForegroundColor Green
}
```

保存後、新しいPowerShellセッションで自動的に設定されます。

---

## SAM CLI も同様に設定

SAM CLIもPATHに追加する必要がある場合:

```powershell
# SAM CLIのパス
$env:Path += ";C:\Program Files\Amazon\AWS SAM CLI\bin\"

# 確認
sam --version
```

---

## トラブルシューティングスクリプト

すべてを確認するスクリプト:

```powershell
# 診断スクリプト
Write-Host "=== AWS CLI 診断 ===" -ForegroundColor Cyan

# インストール確認
$awsPath = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
if (Test-Path $awsPath) {
    Write-Host "✅ AWS CLIインストール確認: OK" -ForegroundColor Green
    Write-Host "   場所: $awsPath"
} else {
    Write-Host "❌ AWS CLIが見つかりません" -ForegroundColor Red
    exit
}

# PATH確認
if ($env:Path -like "*Amazon\AWSCLIV2*") {
    Write-Host "✅ PATH設定: OK" -ForegroundColor Green
} else {
    Write-Host "⚠️  PATHに設定されていません" -ForegroundColor Yellow
    Write-Host "   追加中..."
    $env:Path += ";C:\Program Files\Amazon\AWSCLIV2\"
}

# コマンド実行確認
try {
    $version = aws --version 2>&1
    Write-Host "✅ AWS CLI実行: OK" -ForegroundColor Green
    Write-Host "   バージョン: $version"
} catch {
    Write-Host "❌ AWS CLIが実行できません" -ForegroundColor Red
    Write-Host "   エラー: $_"
}

# プロファイル確認
try {
    $profiles = aws configure list-profiles 2>&1
    if ($profiles) {
        Write-Host "✅ プロファイル設定: OK" -ForegroundColor Green
        Write-Host "   プロファイル: $profiles"
    } else {
        Write-Host "⚠️  プロファイルが設定されていません" -ForegroundColor Yellow
        Write-Host "   設定方法: aws configure --profile eleknowledge-dev"
    }
} catch {
    Write-Host "⚠️  プロファイル確認失敗" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "診断完了" -ForegroundColor Cyan
```

このスクリプトを `check-aws.ps1` として保存して実行:

```powershell
.\check-aws.ps1
```

---

**最終更新:** 2025-10-03  
**作成者:** Development Team
