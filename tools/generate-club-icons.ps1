# Genera los iconos PWA del Club Costa Mar desde el logo oficial.
# Usa System.Drawing (Windows). No instala dependencias.
#
#   icon-192.png / icon-512.png            -> purpose "any" (logo a sangre)
#   icon-192-maskable / icon-512-maskable  -> purpose "maskable" (padding safe zone)
#   apple-touch-icon.png (180x180)         -> iOS

Add-Type -AssemblyName System.Drawing

$src = Resolve-Path "apps/club/src/assets/brand/costamar-logo.png"
$outDir = "apps/club/src/assets/icons"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Fondo de marca para iconos (coherente con background_color del manifest)
$bgColor = [System.Drawing.ColorTranslator]::FromHtml("#f5fbfc")

function New-Icon {
    param(
        [int]$Size,
        [string]$OutPath,
        [double]$Padding, # fracción de padding (0 = a sangre, 0.18 = safe zone)
        [bool]$FillBg
    )
    $logo = [System.Drawing.Image]::FromFile($src)
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($FillBg) {
        $brush = New-Object System.Drawing.SolidBrush($bgColor)
        $g.FillRectangle($brush, 0, 0, $Size, $Size)
        $brush.Dispose()
    }

    $pad = [int]($Size * $Padding)
    $target = $Size - (2 * $pad)
    # Mantener proporción del logo (casi cuadrado)
    $scale = [Math]::Min($target / $logo.Width, $target / $logo.Height)
    $w = [int]($logo.Width * $scale)
    $h = [int]($logo.Height * $scale)
    $x = [int](($Size - $w) / 2)
    $y = [int](($Size - $h) / 2)
    $g.DrawImage($logo, $x, $y, $w, $h)

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose(); $logo.Dispose()
    Write-Host "generado: $OutPath ($Size x $Size)"
}

# Iconos "any": logo sobre fondo de marca, poco padding
New-Icon -Size 192 -OutPath "$outDir/icon-192.png" -Padding 0.08 -FillBg $true
New-Icon -Size 512 -OutPath "$outDir/icon-512.png" -Padding 0.08 -FillBg $true

# Iconos "maskable": más padding (safe zone ~18%) para que Android recorte sin cortar el logo
New-Icon -Size 192 -OutPath "$outDir/icon-192-maskable.png" -Padding 0.18 -FillBg $true
New-Icon -Size 512 -OutPath "$outDir/icon-512-maskable.png" -Padding 0.18 -FillBg $true

# apple-touch-icon (iOS): 180x180, con fondo (iOS no respeta transparencia bien)
New-Icon -Size 180 -OutPath "$outDir/apple-touch-icon.png" -Padding 0.10 -FillBg $true

Write-Host "Listo."
