param(
    [Parameter(Mandatory)][string]$Cluster,
    [Parameter(Mandatory)][string]$TaskDefinition,
    [Parameter(Mandatory)][string]$Subnet,
    [Parameter(Mandatory)][string]$SecurityGroup,
    [Parameter(Mandatory)][string]$Region
)

$ErrorActionPreference = 'Stop'
$network = "awsvpcConfiguration={subnets=[$Subnet],securityGroups=[$SecurityGroup],assignPublicIp=ENABLED}"
$taskArn = & aws ecs run-task `
    --cluster $Cluster `
    --task-definition $TaskDefinition `
    --launch-type FARGATE `
    --platform-version LATEST `
    --network-configuration $network `
    --region $Region `
    --query 'tasks[0].taskArn' `
    --output text `
    --no-cli-pager
if ($LASTEXITCODE -ne 0 -or -not $taskArn -or $taskArn -eq 'None') {
    throw 'Database migration task could not be started.'
}
& aws ecs wait tasks-stopped --cluster $Cluster --tasks $taskArn --region $Region --no-cli-pager
if ($LASTEXITCODE -ne 0) { throw 'Database migration task wait failed.' }
$resultJson = & aws ecs describe-tasks `
    --cluster $Cluster `
    --tasks $taskArn `
    --region $Region `
    --query 'tasks[0].{ExitCode:containers[0].exitCode,Reason:stoppedReason,ContainerReason:containers[0].reason}' `
    --output json `
    --no-cli-pager
if ($LASTEXITCODE -ne 0) { throw 'Database migration result could not be read.' }
$result = ($resultJson -join "`n") | ConvertFrom-Json
if ($result.ExitCode -ne 0) {
    throw "Database migration failed. Reason: $($result.Reason) $($result.ContainerReason)"
}
Write-Host 'Database migration completed successfully.'
