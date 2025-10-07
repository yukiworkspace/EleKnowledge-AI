# ============================================================================
# EleKnowledge-AI Common Functions Library
# Common functions and utilities for PowerShell scripts
# ============================================================================

# Color output functions
function Write-Success {
    param([string]$Message)
    Write-Host "OK $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "INFO $Message" -ForegroundColor Cyan
}

function Write-Warning {
    param([string]$Message)
    Write-Host "WARNING $Message" -ForegroundColor Yellow
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "ERROR $Message" -ForegroundColor Red
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "===========================================================" -ForegroundColor Blue
    Write-Host "  $Message" -ForegroundColor Blue
    Write-Host "===========================================================" -ForegroundColor Blue
    Write-Host ""
}

# Project settings
$Script:ProjectName = "EleKnowledge-AI"
$Script:Environment = "development"
$Script:Region = "us-east-1"
$Script:Profile = "eleknowledge-dev"

# Tag settings
$Script:Tags = @(
    "Project=$ProjectName",
    "Environment=$Environment",
    "ManagedBy=PowerShell",
    "Region=$Region"
)

# AWS CLI Profile Check
function Test-AWSProfile {
    param(
        [string]$ProfileName = $Script:Profile
    )
    
    Write-Info "Checking AWS Profile '$ProfileName'..."
    
    try {
        $identity = aws sts get-caller-identity --profile $ProfileName --output json 2>&1 | ConvertFrom-Json
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "AWS Profile check succeeded"
            Write-Host "  Account: $($identity.Account)"
            Write-Host "  User: $($identity.Arn)"
            return $true
        }
    }
    catch {
        Write-ErrorMsg "AWS Profile '$ProfileName' check failed"
        Write-Host "Error: $_"
        Write-Host ""
        Write-Host "Please check:"
        Write-Host "1. AWS CLI is installed"
        Write-Host "2. Profile '$ProfileName' is configured"
        Write-Host "3. Access key is valid"
        Write-Host ""
        Write-Host "Check profiles: aws configure list-profiles"
        Write-Host "Configure profile: aws configure --profile $ProfileName"
        return $false
    }
    
    return $false
}

# Region Check
function Test-AWSRegion {
    param(
        [string]$RegionName = $Script:Region,
        [string]$ProfileName = $Script:Profile
    )
    
    Write-Info "Checking region '$RegionName'..."
    
    $configuredRegion = aws configure get region --profile $ProfileName 2>&1
    
    if ($configuredRegion -eq $RegionName) {
        Write-Success "Region check succeeded: $RegionName"
        return $true
    }
    else {
        Write-Warning "Configured region differs: $configuredRegion"
        Write-Info "Setting region to $RegionName..."
        
        aws configure set region $RegionName --profile $ProfileName
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Region configuration completed"
            return $true
        }
        else {
            Write-ErrorMsg "Region configuration failed"
            return $false
        }
    }
}

# SAM CLI Check
function Test-SAMCLI {
    Write-Info "Checking SAM CLI..."
    
    try {
        $samVersion = sam --version 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "SAM CLI check succeeded: $samVersion"
            return $true
        }
    }
    catch {
        Write-ErrorMsg "SAM CLI not found"
        Write-Host ""
        Write-Host "Please install SAM CLI:"
        Write-Host "https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
        return $false
    }
    
    return $false
}

# S3 Bucket Existence Check
function Test-S3Bucket {
    param(
        [string]$BucketName,
        [string]$ProfileName = $Script:Profile
    )
    
    try {
        aws s3 ls "s3://$BucketName" --profile $ProfileName 2>&1 | Out-Null
        return ($LASTEXITCODE -eq 0)
    }
    catch {
        return $false
    }
}

# Create S3 Bucket
function New-S3BucketIfNotExists {
    param(
        [string]$BucketName,
        [string]$ProfileName = $Script:Profile,
        [string]$RegionName = $Script:Region
    )
    
    Write-Info "Checking S3 bucket '$BucketName'..."
    
    if (Test-S3Bucket -BucketName $BucketName -ProfileName $ProfileName) {
        Write-Success "S3 bucket already exists: $BucketName"
        return $true
    }
    
    Write-Info "Creating S3 bucket '$BucketName'..."
    
    if ($RegionName -eq "us-east-1") {
        aws s3 mb "s3://$BucketName" --profile $ProfileName 2>&1 | Out-Null
    }
    else {
        aws s3 mb "s3://$BucketName" --region $RegionName --profile $ProfileName 2>&1 | Out-Null
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "S3 bucket created: $BucketName"
        
        # Add tags
        $tagJson = "{`"TagSet`":[{`"Key`":`"Project`",`"Value`":`"$ProjectName`"},{`"Key`":`"Environment`",`"Value`":`"$Environment`"},{`"Key`":`"ManagedBy`",`"Value`":`"PowerShell`"}]}"
        aws s3api put-bucket-tagging --bucket $BucketName --tagging $tagJson --profile $ProfileName 2>&1 | Out-Null
        
        # Enable versioning
        aws s3api put-bucket-versioning --bucket $BucketName --versioning-configuration Status=Enabled --profile $ProfileName 2>&1 | Out-Null
        
        # Set public access block
        aws s3api put-public-access-block --bucket $BucketName --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" --profile $ProfileName 2>&1 | Out-Null
        
        Write-Success "S3 bucket configuration completed"
        return $true
    }
    else {
        Write-ErrorMsg "S3 bucket creation failed"
        return $false
    }
}

# CloudFormation Stack Existence Check
function Test-CloudFormationStack {
    param(
        [string]$StackName,
        [string]$ProfileName = $Script:Profile,
        [string]$RegionName = $Script:Region
    )
    
    try {
        $stack = aws cloudformation describe-stacks --stack-name $StackName --region $RegionName --profile $ProfileName --output json 2>&1 | ConvertFrom-Json
        
        if ($LASTEXITCODE -eq 0 -and $stack.Stacks.Count -gt 0) {
            $status = $stack.Stacks[0].StackStatus
            
            if ($status -like "*_COMPLETE" -or $status -like "*_IN_PROGRESS") {
                return $true
            }
        }
        
        return $false
    }
    catch {
        return $false
    }
}

# Get CloudFormation Stack Status
function Get-CloudFormationStackStatus {
    param(
        [string]$StackName,
        [string]$ProfileName = $Script:Profile,
        [string]$RegionName = $Script:Region
    )
    
    try {
        $stack = aws cloudformation describe-stacks --stack-name $StackName --region $RegionName --profile $ProfileName --output json 2>&1 | ConvertFrom-Json
        
        if ($LASTEXITCODE -eq 0 -and $stack.Stacks.Count -gt 0) {
            return $stack.Stacks[0].StackStatus
        }
        
        return $null
    }
    catch {
        return $null
    }
}

# Get CloudFormation Stack Outputs
function Get-CloudFormationStackOutputs {
    param(
        [string]$StackName,
        [string]$ProfileName = $Script:Profile,
        [string]$RegionName = $Script:Region
    )
    
    try {
        $stack = aws cloudformation describe-stacks --stack-name $StackName --region $RegionName --profile $ProfileName --output json 2>&1 | ConvertFrom-Json
        
        if ($LASTEXITCODE -eq 0 -and $stack.Stacks.Count -gt 0) {
            $outputs = @{}
            
            foreach ($output in $stack.Stacks[0].Outputs) {
                $outputs[$output.OutputKey] = $output.OutputValue
            }
            
            return $outputs
        }
        
        return $null
    }
    catch {
        return $null
    }
}

# Confirmation Prompt
function Confirm-Action {
    param(
        [string]$Message,
        [bool]$DefaultYes = $true
    )
    
    $prompt = if ($DefaultYes) { "$Message [Y/n]" } else { "$Message [y/N]" }
    
    Write-Host ""
    $response = Read-Host $prompt
    
    if ([string]::IsNullOrWhiteSpace($response)) {
        return $DefaultYes
    }
    
    return $response -match '^[Yy]'
}

# Execute Command with Error Handling
function Invoke-CommandWithErrorHandling {
    param(
        [string]$Command,
        [string]$ErrorMessage = "Command execution failed",
        [bool]$ContinueOnError = $false
    )
    
    Write-Info "Executing: $Command"
    
    try {
        Invoke-Expression $Command
        
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorMsg $ErrorMessage
            
            if (-not $ContinueOnError) {
                throw $ErrorMessage
            }
            
            return $false
        }
        
        return $true
    }
    catch {
        Write-ErrorMsg "$ErrorMessage : $_"
        
        if (-not $ContinueOnError) {
            throw
        }
        
        return $false
    }
}

# SAM Build
function Invoke-SAMBuild {
    param(
        [string]$TemplatePath,
        [bool]$UseContainer = $false
    )
    
    Write-Step "SAM Build"
    
    $buildCommand = "sam build --template $TemplatePath"
    
    if ($UseContainer) {
        $buildCommand += " --use-container"
    }
    
    return Invoke-CommandWithErrorHandling -Command $buildCommand -ErrorMessage "SAM Build failed"
}

# SAM Deploy
function Invoke-SAMDeploy {
    param(
        [string]$StackName,
        [string]$ProfileName = $Script:Profile,
        [bool]$Guided = $false,
        [hashtable]$ParameterOverrides = @{}
    )
    
    Write-Step "SAM Deploy"
    
    $deployCommand = "sam deploy --stack-name $StackName --profile $ProfileName"
    
    if ($Guided) {
        $deployCommand += " --guided"
    }
    
    if ($ParameterOverrides.Count -gt 0) {
        $params = ($ParameterOverrides.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join " "
        $deployCommand += " --parameter-overrides $params"
    }
    
    return Invoke-CommandWithErrorHandling -Command $deployCommand -ErrorMessage "SAM Deploy failed"
}

# Import Environment File
function Import-EnvFile {
    param(
        [string]$EnvFilePath = ".env"
    )
    
    if (Test-Path $EnvFilePath) {
        Write-Info "Loading .env file..."
        
        Get-Content $EnvFilePath | ForEach-Object {
            if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                
                [System.Environment]::SetEnvironmentVariable($name, $value, [System.EnvironmentVariableTarget]::Process)
            }
        }
        
        Write-Success ".env file loaded"
    }
    else {
        Write-Warning ".env file not found: $EnvFilePath"
    }
}

# Exit Script
function Exit-Script {
    param(
        [int]$ExitCode = 0,
        [string]$Message = ""
    )
    
    Write-Host ""
    
    if ($ExitCode -eq 0) {
        if ($Message) {
            Write-Success $Message
        }
        Write-Success "Script execution completed"
    }
    else {
        if ($Message) {
            Write-ErrorMsg $Message
        }
        Write-ErrorMsg "Script execution failed (ExitCode: $ExitCode)"
    }
    
    Write-Host ""
    exit $ExitCode
}
