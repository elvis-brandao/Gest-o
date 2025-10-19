$ErrorActionPreference = 'Stop'
$baseDir = Join-Path $PSScriptRoot '..'
$assetsDir = Join-Path $baseDir 'assets'
$iconsDir = Join-Path $assetsDir 'icons'
if (!(Test-Path $iconsDir)) { New-Item -ItemType Directory -Path $iconsDir | Out-Null }
Add-Type -AssemblyName System.Drawing
Write-Output ("Generating icons in {0}" -f $iconsDir)
function New-Icon {
  param([int]$size, [string]$path, [double]$safe = 0.2)
  try {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $bgColor = [System.Drawing.ColorTranslator]::FromHtml('#3b5b70')
    $brush = New-Object System.Drawing.SolidBrush $bgColor
    $gfx.FillRectangle($brush, 0, 0, $size, $size)
    $fontSize = [math]::Round($size * 0.5)
    try {
      $font = New-Object System.Drawing.Font -ArgumentList 'Segoe UI', $fontSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    }
    catch {
      $font = New-Object System.Drawing.Font -ArgumentList 'Arial', $fontSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    }
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $margin = [float]($size * $safe)
    $rect = New-Object System.Drawing.RectangleF $margin, $margin, ([float]($size - 2 * $margin)), ([float]($size - 2 * $margin))
    $gfx.DrawString('FP', $font, [System.Drawing.Brushes]::White, $rect, $fmt)
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $gfx.Dispose(); $bmp.Dispose(); $brush.Dispose(); $font.Dispose()
    Write-Output ("Created {0}" -f $path)
  } catch {
    Write-Output ("Failed to create {0}: {1}" -f $path, $_.Exception.Message)
  }
}
New-Icon -size 192 -path (Join-Path $iconsDir 'icon-192.png') -safe 0.1
New-Icon -size 512 -path (Join-Path $iconsDir 'icon-512.png') -safe 0.1
New-Icon -size 192 -path (Join-Path $iconsDir 'icon-192-maskable.png') -safe 0.2
New-Icon -size 180 -path (Join-Path $iconsDir 'apple-touch-icon.png') -safe 0.1
Write-Output 'Done.'