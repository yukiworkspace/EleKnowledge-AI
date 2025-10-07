# 📄 大容量PDF対応ガイド - Knowledge Base用

## 概要

Knowledge Baseに保管するPDFファイルには**50MBのサイズ制限**があります。
大きなPDFファイルは、アップロード前に**45MB以下**に分割する必要があります。

**注意:** 自動分割Lambda機能はPython 3.13での依存関係の問題により保留中です。
当面は手動で分割してアップロードしてください。

---

## 手動PDF分割方法

### 方法1: Adobe Acrobat Proを使用（推奨）

1. Adobe Acrobat Proで大容量PDFを開く
2. **ツール** → **ページを整理** を選択
3. **分割** ボタンをクリック
4. 分割オプションを選択：
   - **ファイルサイズ**: 45MB
   - または **ページ数**: 適切なページ数を計算
5. **出力オプション**:
   - ファイル名に`_part1`, `_part2`を追加
6. **分割** を実行

### 方法2: オンラインツール（無料）

**推奨サイト:**
- https://www.ilovepdf.com/split_pdf
- https://smallpdf.com/split-pdf

**手順:**
1. サイトにアクセス
2. PDFファイルをアップロード
3. 分割方法を選択：
   - **カスタム範囲**でページ数を指定
   - または**ファイルサイズ**で45MBを指定
4. 分割実行
5. ダウンロード

### 方法3: PowerShellスクリプト（要PDFツール）

```powershell
# PDFtkツールを使用（事前インストール必要）
# https://www.pdflabs.com/tools/pdftk-the-pdf-toolkit/

# 総ページ数確認
pdftk large-manual.pdf dump_data

# ページ範囲で分割
pdftk large-manual.pdf cat 1-50 output large-manual_part1.pdf
pdftk large-manual.pdf cat 51-100 output large-manual_part2.pdf
```

---

## ファイル命名規則

### 分割ファイルの命名

```
元ファイル:
manual_ProductA_v2.0.pdf (60MB)

分割後:
manual_ProductA_v2.0_part1.pdf (45MB)
manual_ProductA_v2.0_part2.pdf (15MB)
```

**ルール:**
- `_part1`, `_part2`, `_part3` の形式で番号を付ける
- 元のファイル名は保持
- 拡張子は `.pdf`

---

## S3へのアップロード

### メタデータ付きアップロード

```powershell
$bucketName = "eleknowledge-ai-development-documents"

# Part 1をアップロード
aws s3 cp "manual_ProductA_v2.0_part1.pdf" `
  "s3://$bucketName/manuals/electrical/manual_ProductA_v2.0_part1.pdf" `
  --metadata document-type=manual,product=ProductA,model=v2.0,category=electrical `
  --profile eleknowledge-dev

# Part 2をアップロード（同じメタデータ）
aws s3 cp "manual_ProductA_v2.0_part2.pdf" `
  "s3://$bucketName/manuals/electrical/manual_ProductA_v2.0_part2.pdf" `
  --metadata document-type=manual,product=ProductA,model=v2.0,category=electrical `
  --profile eleknowledge-dev
```

**重要:** すべての分割ファイルに同じメタデータを設定してください。

---

## Knowledge Base同期

分割ファイルをアップロード後、Knowledge Baseを同期します。

```powershell
# Knowledge Base同期
# 詳細は docs/knowledge-base-setup.md を参照
```

Knowledge Baseは分割ファイルをそれぞれ独立したドキュメントとして扱います。

---

## ファイルサイズ確認

### PowerShellでサイズ確認

```powershell
# MB単位で表示
$file = Get-Item "manual.pdf"
$sizeMB = $file.Length / 1MB
Write-Host "File size: $sizeMB MB"

# 45MBを超えているかチェック
if ($sizeMB -gt 45) {
    Write-Host "WARNING: File size exceeds 45MB. Split required." -ForegroundColor Yellow
} else {
    Write-Host "OK: File size is within limit." -ForegroundColor Green
}
```

### 複数ファイルを一括チェック

```powershell
# ディレクトリ内のすべてのPDFをチェック
Get-ChildItem "*.pdf" | ForEach-Object {
    $sizeMB = $_.Length / 1MB
    $status = if ($sizeMB -gt 45) { "⚠️ SPLIT REQUIRED" } else { "✅ OK" }
    Write-Host "$($_.Name): $([math]::Round($sizeMB, 2)) MB - $status"
}
```

---

## 推奨ワークフロー

### 新規ドキュメント追加時

```
1. PDFファイルサイズ確認
   ├─ 45MB以下 → そのままアップロード
   └─ 45MB超過 → 分割処理
   ↓
2. 分割（必要な場合）
   ├─ Adobe Acrobat / オンラインツール
   └─ ファイル名に _part1, _part2 追加
   ↓
3. メタデータ準備
   ├─ document-type
   ├─ product
   ├─ model
   └─ category
   ↓
4. S3にアップロード
   └─ すべての分割ファイルに同じメタデータ
   ↓
5. Knowledge Base同期
   └─ AWS Console または CLI
```

---

## 将来の自動化

**Python 3.11対応のLambda関数を別途作成予定**

PDF自動分割Lambda関数は、Python 3.11ランタイムで再実装予定です。
現時点ではPython 3.13での依存関係の問題により保留しています。

### 代替案
- Python 3.11ランタイムでPDF Splitter Lambdaを作成
- または手動分割のまま運用

---

## ベストプラクティス

### 1. ファイル準備

- ✅ 事前にファイルサイズを確認
- ✅ 45MB以下になるよう分割
- ✅ 命名規則に従う（_part1, _part2）
- ✅ すべての分割ファイルに同じメタデータ

### 2. アップロード

- ✅ メタデータを必ず設定
- ✅ 適切なディレクトリに配置
- ✅ 分割ファイルを順番にアップロード

### 3. 同期＆確認

- ✅ アップロード後すぐに同期
- ✅ テストクエリで検索確認
- ✅ すべての分割ファイルが検索可能か確認

---

## FAQ

### Q: 分割したPDFは検索できますか？

**A:** はい。Knowledge Baseは各分割ファイルを独立したドキュメントとして扱います。
ユーザーが質問すると、関連する部分（どの分割ファイルにあるか）が自動的に検索されます。

### Q: 分割前の元ファイルも必要ですか？

**A:** いいえ。分割後のファイルのみをアップロードすれば十分です。
ただし、バックアップとして元ファイルを別の場所に保管することを推奨します。

### Q: メタデータは必須ですか？

**A:** メタデータがなくても動作しますが、検索精度とフィルタリング機能のために推奨します。

---

## 完了チェックリスト

- [ ] 大容量PDFファイルを特定
- [ ] ファイルサイズを確認（45MB超過）
- [ ] 分割ツールで45MB以下に分割
- [ ] ファイル名に _part1, _part2 追加
- [ ] すべての分割ファイルに同じメタデータを設定
- [ ] S3にアップロード完了
- [ ] Knowledge Base同期完了
- [ ] テストクエリで検索確認

---

**大容量PDFは事前に45MB以下に分割してからアップロードしてください！**
