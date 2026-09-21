[CmdletBinding()]
param(
    [string]$File = 'main.tex',
    [string]$Compiler = ''
)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $File).Path
if (-not $Compiler) {
    foreach ($name in @('tectonic', 'xelatex')) {
        $candidate = Get-Command $name -ErrorAction SilentlyContinue
        if ($candidate) { $Compiler = $candidate.Source; break }
    }
    if (-not $Compiler) {
        $bundled = Join-Path $env:USERPROFILE '.codex\.tmp\bundled-marketplaces\openai-bundled\plugins\latex\bin\tectonic.exe'
        if (Test-Path -LiteralPath $bundled) { $Compiler = $bundled }
    }
}
if (-not $Compiler) {
    throw 'Install XeLaTeX or Tectonic, or supply -Compiler with the executable path.'
}
$engine = [IO.Path]::GetFileNameWithoutExtension($Compiler)
if ($engine -notin @('tectonic', 'xelatex')) {
    throw 'Supported compilers: tectonic, xelatex.'
}
Push-Location (Split-Path -LiteralPath $source)
try {
    New-Item -ItemType Directory -Force -Path '.build' | Out-Null
    $name = [IO.Path]::GetFileName($source)
    if ($engine -eq 'tectonic') {
        & $Compiler $name --keep-logs --outdir .build
        if ($LASTEXITCODE -ne 0) { throw 'Compilation failed. See .build for logs.' }
    } else {
        for ($pass = 0; $pass -lt 2; $pass++) {
            & $Compiler '-interaction=nonstopmode' '-halt-on-error' '-output-directory=.build' $name
            if ($LASTEXITCODE -ne 0) { throw 'Compilation failed. See .build for logs.' }
        }
    }
    $pdf = [IO.Path]::GetFileNameWithoutExtension($source) + '.pdf'
    Copy-Item -LiteralPath (Join-Path '.build' $pdf) -Destination $pdf -Force
    Write-Host "Created: $(Join-Path (Get-Location).Path $pdf)"
} finally {
    Pop-Location
}
