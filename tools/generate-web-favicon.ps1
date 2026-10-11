# Genera el favicon de la web publica desde el logo oficial de Costa Mar.
Add-Type -AssemblyName System.Drawing

$src = Resolve-Path "apps/web/src/assets/brand/costamar-logo.png"
$outDir = "apps/web/src/assets/icons"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-Png {
    param([int]$Size, [string]$OutPath)
    $logo = [System.Drawing.Image]::FromFile($src)
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $scale = [Math]::Min($Size / $logo.Width, $Size / $logo.Height)
    $w = [int]($logo.Width * $scale); $h = [int]($logo.Height * $scale)
    $x = [int](($Size - $w) / 2); $y = [int](($Size - $h) / 2)
    $g.DrawImage($logo, $x, $y, $w, $h)
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose(); $logo.Dispose()
}

$fav32 = "$outDir/favicon-32.png"
New-Png -Size 32 -OutPath $fav32
New-Png -Size 16 -OutPath "$outDir/favicon-16.png"
New-Png -Size 180 -OutPath "$outDir/apple-touch-icon.png"

$png = [System.Drawing.Bitmap]::FromFile($fav32)
$icon = [System.Drawing.Icon]::FromHandle($png.GetHicon())
$fs = New-Object System.IO.FileStream("apps/web/src/favicon.ico", [System.IO.FileMode]::Create)
$icon.Save($fs); $fs.Close(); $png.Dispose()
Write-Host "favicon web generado"
