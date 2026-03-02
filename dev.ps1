# dev.ps1 — One-command ODIN stack start (Podman + WSL2)
param(
    [switch]$NoBuild,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$RepoRoot = Get-Location
$EnvFile = "$RepoRoot\.env"
$WSLDistro = "podman-machine-default"

# Convert Windows path → WSL mount path
$drive = $RepoRoot.Path.Substring(0, 1).ToLower()
$rest = $RepoRoot.Path.Substring(2).Replace('\', '/')
$WSLRoot = "/mnt/$drive$rest"

Write-Host "`n=== ODIN Developer Experience ===" -ForegroundColor Cyan

# ── 1. Ensure Podman Machine is running ──────────────────────────────────
Write-Host "[1/5] Checking Podman Machine..." -ForegroundColor Gray
$machineStatus = podman machine inspect --format "{{.State}}" 2>$null
if ($machineStatus -ne "running") {
    Write-Host "  Starting Podman machine..." -ForegroundColor Yellow
    podman machine start
}
Write-Host "  Podman machine is running." -ForegroundColor Green

# ── 2. Bootstrap rootless runtime dirs (WSL2 has no systemd) ─────────────
Write-Host "[2/5] Bootstrapping WSL runtime directories..." -ForegroundColor Gray
wsl -u root -d $WSLDistro bash -c "mkdir -p /run/user/1000/containers/networks/aardvark-dns && chown -R 1000:1000 /run/user/1000"

# ── 3. Ensure podman-compose is available ────────────────────────────────
Write-Host "[3/5] Checking podman-compose in WSL..." -ForegroundColor Gray
wsl -u root -d $WSLDistro which podman-compose > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Installing podman-compose..." -ForegroundColor Yellow
    wsl -u root -d $WSLDistro dnf install -y podman-compose
}
Write-Host "  podman-compose is available." -ForegroundColor Green

# ── 4. Validate .env ─────────────────────────────────────────────────────
Write-Host "[4/5] Validating .env..." -ForegroundColor Gray
if (-not (Test-Path $EnvFile)) {
    Write-Host "  ERROR: .env file missing at $EnvFile" -ForegroundColor Red
    Write-Host "  Copy .env.example to .env and fill in DB_PASSWORD." -ForegroundColor Yellow
    exit 1
}
$envContent = Get-Content $EnvFile -Raw
if ($envContent -notmatch "DB_PASSWORD=\S+") {
    Write-Host "  WARNING: DB_PASSWORD appears unset in .env" -ForegroundColor Yellow
}
Write-Host "  .env OK." -ForegroundColor Green

# ── 5. Start the stack ───────────────────────────────────────────────────
Write-Host "[5/5] Starting ODIN Stack..." -ForegroundColor Cyan

if ($Clean) {
    Write-Host "  Cleaning old containers..." -ForegroundColor Yellow
    wsl -u root -d $WSLDistro --cd "$WSLRoot" podman-compose -f podman-compose.wsl.yml down -v 2>$null
}

$upArgs = @("up", "-d")
if (-not $NoBuild) { $upArgs += "--build" }

wsl -u root -d $WSLDistro --cd "$WSLRoot" podman-compose -f podman-compose.wsl.yml $upArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n  Stack start FAILED." -ForegroundColor Red
    Write-Host "  Check logs: podman logs odin-postgres" -ForegroundColor Yellow
    exit 1
}

# ── Done ─────────────────────────────────────────────────────────────────
Write-Host "`n=== ODIN Stack is UP ===" -ForegroundColor Green
Write-Host "  Frontend:       http://localhost:8000"
Write-Host "  Backend Health: http://localhost:8001/api/health"
Write-Host "  pgAdmin:        http://localhost:8003"
Write-Host "`nStreaming logs (Ctrl+C to stop)..." -ForegroundColor Gray

wsl -u root -d $WSLDistro --cd "$WSLRoot" podman-compose -f podman-compose.wsl.yml logs -f --tail 200
