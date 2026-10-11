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

# ----- Favicons desde el logo (PNG 16/32/48 + favicon.ico multi-size) -----
function New-FaviconPng {
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
    return $OutPath
}

$fav32 = New-FaviconPng -Size 32 -OutPath "$outDir/favicon-32.png"
New-FaviconPng -Size 16 -OutPath "$outDir/favicon-16.png" | Out-Null

# favicon.ico desde el PNG 32x32 (ICO con un solo tamaño es válido y suficiente)
$png = [System.Drawing.Bitmap]::FromFile($fav32)
$icon = [System.Drawing.Icon]::FromHandle($png.GetHicon())
$fs = New-Object System.IO.FileStream("apps/club/src/favicon.ico", [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close(); $png.Dispose()
Write-Host "favicon.ico generado desde el logo"
