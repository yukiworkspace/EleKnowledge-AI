# ============================================================================
# EleKnowledge-AI Phase 1 Setup Script
# Deploy: Cognito, DynamoDB, S3, Lambda, API Gateway
# ============================================================================

param(
    [string]$Profile = "eleknowledge-dev",
    [string]$Environment = "development",
    [switch]$SkipConfirmation,
    [switch]$Guided
)

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)

# Add AWS CLI and SAM CLI to PATH if not present
if (-not ($env:Path -like "*Amazon\AWSCLIV2*")) {
    $env:Path += ";C:\Program Files\Amazon\AWSCLIV2\"
}
if (-not ($env:Path -like "*Amazon\AWSSAMCLI*")) {
    $env:Path += ";C:\Program Files\Amazon\AWSSAMCLI\bin\"
}

# Import common functions
. "$ScriptDir\common.ps1"

# Set profile and region
$Script:Profile = $Profile
$Script:Region = "us-east-1"

# Project settings
$ProjectName = "EleKnowledge-AI"
$StackName = "$ProjectName-$Environment-phase1"
$SAMArtifactsBucket = "$ProjectName-$Environment-sam-artifacts".ToLower()

# ============================================================================
# Main Process
# ============================================================================

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  EleKnowledge-AI Phase 1 Setup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project: $ProjectName"
Write-Host "Environment: $Environment"
Write-Host "Stack Name: $StackName"
Write-Host "Profile: $Profile"
Write-Host "Region: $Script:Region"
Write-Host ""

# ============================================================================
# 1. Prerequisites Check
# ============================================================================

Write-Step "Step 1: Prerequisites Check"

# AWS CLI Check
if (-not (Test-AWSProfile -ProfileName $Profile)) {
    Exit-Script -ExitCode 1 -Message "AWS Profile check failed"
}

# Region Check
if (-not (Test-AWSRegion -RegionName $Script:Region -ProfileName $Profile)) {
    Exit-Script -ExitCode 1 -Message "Region check failed"
}

# SAM CLI Check
if (-not (Test-SAMCLI)) {
    Exit-Script -ExitCode 1 -Message "SAM CLI check failed"
}

Write-Success "Prerequisites check completed"

# ============================================================================
# 2. Create SAM Artifacts Bucket
# ============================================================================

Write-Step "Step 2: Create SAM Artifacts Bucket"

if (-not (New-S3BucketIfNotExists -BucketName $SAMArtifactsBucket -ProfileName $Profile -RegionName $Script:Region)) {
    Exit-Script -ExitCode 1 -Message "Failed to create SAM artifacts bucket"
}

# ============================================================================
# 3. Prepare Lambda Function Code
# ============================================================================

Write-Step "Step 3: Prepare Lambda Function Code"

$lambdaDirs = @(
    "$RootDir\lambda\auth\signup",
    "$RootDir\lambda\auth\login",
    "$RootDir\lambda\auth\verify"
)

$missingDirs = @()

foreach ($dir in $lambdaDirs) {
    if (-not (Test-Path $dir)) {
        $missingDirs += $dir
        Write-Warning "Lambda function directory not found: $dir"
    }
    else {
        $appFile = Join-Path $dir "app.py"
        if (-not (Test-Path $appFile)) {
            Write-Warning "app.py not found: $appFile"
            Write-Info "Creating placeholder..."
            
            # Create placeholder Python file
            $placeholder = @"
import json
import os

def lambda_handler(event, context):
    """
    Lambda function handler (placeholder)
    TODO: Implementation required
    """
    return {
        'statusCode': 501,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'message': 'Not Implemented - Placeholder function',
            'function': os.environ.get('AWS_LAMBDA_FUNCTION_NAME', 'unknown')
        })
    }
"@
            Set-Content -Path $appFile -Value $placeholder -Encoding UTF8
            Write-Success "Placeholder created: $appFile"
        }
        
        # Check requirements.txt
        $requirementsFile = Join-Path $dir "requirements.txt"
        if (-not (Test-Path $requirementsFile)) {
            Write-Info "Creating requirements.txt..."
            
            $requirements = @"
boto3>=1.28.0
"@
            Set-Content -Path $requirementsFile -Value $requirements -Encoding UTF8
            Write-Success "requirements.txt created: $requirementsFile"
        }
    }
}

if ($missingDirs.Count -gt 0) {
    Write-Warning "Some Lambda function directories were not found"
    Write-Info "Continuing with placeholders"
}

# ============================================================================
# 4. Verify SAM Template
# ============================================================================

Write-Step "Step 4: Verify SAM Template"

$templatePath = "$RootDir\infrastructure\sam\phase1-template.yaml"

if (-not (Test-Path $templatePath)) {
    Write-Error "SAM template not found: $templatePath"
    Exit-Script -ExitCode 1 -Message "SAM template not found"
}

Write-Success "SAM template verified: $templatePath"

# ============================================================================
# 5. Check Existing Stack
# ============================================================================

Write-Step "Step 5: Check Existing Stack"

if (Test-CloudFormationStack -StackName $StackName -ProfileName $Profile -RegionName $Script:Region) {
    $stackStatus = Get-CloudFormationStackStatus -StackName $StackName -ProfileName $Profile -RegionName $Script:Region
    Write-Info "Existing stack found"
    Write-Host "  Stack Name: $StackName"
    Write-Host "  Status: $stackStatus"
    Write-Host ""
    
    if (-not $SkipConfirmation) {
        if (-not (Confirm-Action -Message "Update existing stack?")) {
            Exit-Script -ExitCode 0 -Message "Cancelled by user"
        }
    }
}
else {
    Write-Info "Creating new stack: $StackName"
    
    if (-not $SkipConfirmation) {
        Write-Host ""
        Write-Host "The following resources will be created:"
        Write-Host "  - Cognito User Pool"
        Write-Host "  - DynamoDB Tables (users, chatlogs)"
        Write-Host "  - S3 Buckets (documents, uploads)"
        Write-Host "  - Lambda Functions (signup, login, verify)"
        Write-Host "  - API Gateway (Auth API)"
        Write-Host "  - IAM Role (Lambda execution role)"
        Write-Host ""
        
        if (-not (Confirm-Action -Message "Start Phase 1 deployment?")) {
            Exit-Script -ExitCode 0 -Message "Cancelled by user"
        }
    }
}

# ============================================================================
# 6. SAM Build
# ============================================================================

Write-Step "Step 6: SAM Build"

# Move to SAM directory
Push-Location "$RootDir\infrastructure\sam"

try {
    Write-Info "Running SAM Build..."
    
    $buildCommand = "sam build --template phase1-template.yaml --use-container"
    
    Invoke-Expression $buildCommand
    
    if ($LASTEXITCODE -ne 0) {
        throw "SAM Build failed"
    }
    
    Write-Success "SAM Build completed"
}
catch {
    Pop-Location
    Write-Error "Error during SAM Build: $_"
    Exit-Script -ExitCode 1 -Message "SAM Build failed"
}

# ============================================================================
# 7. SAM Deploy
# ============================================================================

Write-Step "Step 7: SAM Deploy"

try {
    Write-Info "Running SAM Deploy..."
    
    $deployCommand = "sam deploy --stack-name $StackName --profile $Profile --region $Script:Region"
    
    if ($Guided) {
        $deployCommand += " --guided"
    }
    else {
        $deployCommand += " --no-confirm-changeset --no-fail-on-empty-changeset"
    }
    
    Invoke-Expression $deployCommand
    
    if ($LASTEXITCODE -ne 0) {
        throw "SAM Deploy failed"
    }
    
    Write-Success "SAM Deploy completed"
}
catch {
    Pop-Location
    Write-Error "Error during SAM Deploy: $_"
    Exit-Script -ExitCode 1 -Message "SAM Deploy failed"
}
finally {
    Pop-Location
}

# ============================================================================
# 8. Verify Deployment Results
# ============================================================================

Write-Step "Step 8: Verify Deployment Results"

Write-Info "Retrieving stack information..."

$outputs = Get-CloudFormationStackOutputs -StackName $StackName -ProfileName $Profile -RegionName $Script:Region

if ($null -eq $outputs) {
    Write-Warning "Failed to retrieve stack outputs"
}
else {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  Deployment Complete - Resource Information" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    
    # Cognito
    if ($outputs.ContainsKey("CognitoUserPoolId")) {
        Write-Host "Cognito User Pool:" -ForegroundColor Cyan
        Write-Host "  Pool ID: $($outputs.CognitoUserPoolId)"
        Write-Host "  Client ID: $($outputs.CognitoClientId)"
        Write-Host ""
    }
    
    # DynamoDB
    if ($outputs.ContainsKey("UsersTableName")) {
        Write-Host "DynamoDB Tables:" -ForegroundColor Cyan
        Write-Host "  Users Table: $($outputs.UsersTableName)"
        Write-Host "  Chat Logs Table: $($outputs.ChatLogsTableName)"
        Write-Host ""
    }
    
    # S3
    if ($outputs.ContainsKey("DocumentsBucketName")) {
        Write-Host "S3 Buckets:" -ForegroundColor Cyan
        Write-Host "  Documents: $($outputs.DocumentsBucketName)"
        Write-Host "  Uploads: $($outputs.UploadsBucketName)"
        Write-Host ""
    }
    
    # API Gateway
    if ($outputs.ContainsKey("AuthApiUrl")) {
        Write-Host "API Gateway:" -ForegroundColor Cyan
        Write-Host "  Auth API URL: $($outputs.AuthApiUrl)"
        Write-Host ""
    }
    
    # Lambda
    Write-Host "Lambda Functions:" -ForegroundColor Cyan
    Write-Host "  Signup: $($outputs.SignupFunctionArn)"
    Write-Host "  Login: $($outputs.LoginFunctionArn)"
    Write-Host "  Verify: $($outputs.VerifyFunctionArn)"
    Write-Host ""
}

# ============================================================================
# 9. Update .env File
# ============================================================================

Write-Step "Step 9: Environment Variables Update"

if ($null -ne $outputs) {
    Write-Info "Add the following environment variables to your .env file:"
    Write-Host ""
    Write-Host "# Phase 1 Deployment Results ($(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))"
    Write-Host "COGNITO_USER_POOL_ID=$($outputs.CognitoUserPoolId)"
    Write-Host "COGNITO_CLIENT_ID=$($outputs.CognitoClientId)"
    Write-Host "DYNAMODB_USERS_TABLE=$($outputs.UsersTableName)"
    Write-Host "DYNAMODB_CHATLOGS_TABLE=$($outputs.ChatLogsTableName)"
    Write-Host "S3_DOCUMENTS_BUCKET=$($outputs.DocumentsBucketName)"
    Write-Host "S3_UPLOADS_BUCKET=$($outputs.UploadsBucketName)"
    Write-Host "API_GATEWAY_AUTH_URL=$($outputs.AuthApiUrl)"
    Write-Host ""
}

# ============================================================================
# 10. Next Steps
# ============================================================================

Write-Host ""
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "  Next Steps" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "1. Phase 1 Deployment Complete"
Write-Host ""
Write-Host "2. Implement Lambda Functions"
Write-Host "   - lambda/auth/signup/app.py"
Write-Host "   - lambda/auth/login/app.py"
Write-Host "   - lambda/auth/verify/app.py"
Write-Host ""
Write-Host "3. Test Lambda Functions"
Write-Host "   sam local invoke SignupFunction --event events/signup-event.json"
Write-Host ""
Write-Host "4. Configure WAF (Manual)"
Write-Host "   - Create AWS WAF ACL"
Write-Host "   - IP Set: 192.168.28.0/24"
Write-Host "   - Rate limiting rules"
Write-Host ""
Write-Host "5. Setup Amplify Hosting (Manual)"
Write-Host "   - Deploy Next.js project to Amplify"
Write-Host "   - Attach WAF ACL"
Write-Host ""
Write-Host "6. Prepare for Phase 2"
Write-Host "   - Build Knowledge Base"
Write-Host "   - Implement RAG Lambda"
Write-Host ""

Exit-Script -ExitCode 0 -Message "Phase 1 setup completed successfully"
