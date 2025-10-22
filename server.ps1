param(
  [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Web
$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Servidor iniciado em $prefix servindo $(Get-Location)"

function Get-ContentType([string]$path) {
  switch ([System.IO.Path]::GetExtension($path).ToLower()) {
    ".html" { return "text/html; charset=utf-8" }
    ".htm"  { return "text/html; charset=utf-8" }
    ".js"   { return "application/javascript; charset=utf-8" }
    ".css"  { return "text/css; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".png"  { return "image/png" }
    ".jpg"  { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".svg"  { return "image/svg+xml" }
    default  { return "application/octet-stream" }
  }
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $request = $context.Request
  $response = $context.Response

  $localPath = $request.Url.LocalPath.TrimStart('/')
  if ([string]::IsNullOrEmpty($localPath)) { $localPath = "index.html" }
  $fullPath = Join-Path -Path (Get-Location) -ChildPath $localPath

  if (Test-Path $fullPath) {
    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $response.ContentType = Get-ContentType $fullPath
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $response.StatusCode = 404
    $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
  }

  $response.OutputStream.Close()
}