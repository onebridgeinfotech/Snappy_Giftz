param(
  [string]$ZipPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'Snappy_Giftz-main.zip'),
  [string]$RemoteName = 'Snappy_Giftz-main.zip',
  [string]$UploadUrl,
  [string]$AuthKey,
  [string]$RestAuthKey
)

if (-not (Test-Path $ZipPath)) { throw "Missing archive: $ZipPath" }
$size = (Get-Item $ZipPath).Length
$target = "$UploadUrl/$RemoteName" + '?override=true'

$commonHeaders = @(
  "-H", "X-Auth: $AuthKey",
  "-H", "X-Auth-Rest: $RestAuthKey",
  "-H", "Tus-Resumable: 1.0.0"
)

Write-Host "TUS create upload ($size bytes)..."
& curl.exe -sS -i -X POST $target `
  @commonHeaders `
  -H "Upload-Length: $size" `
  -H "Upload-Offset: 0"

Write-Host "TUS patch upload..."
& curl.exe -sS -i -X PATCH $target `
  @commonHeaders `
  -H "Content-Type: application/offset+octet-stream" `
  -H "Upload-Offset: 0" `
  --data-binary "@$ZipPath"
