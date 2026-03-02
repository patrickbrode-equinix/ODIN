# down.ps1 — Stop and clean the ODIN stack
$RepoRoot = Get-Location
$WSLDistro = "podman-machine-default"

$drive = $RepoRoot.Path.Substring(0, 1).ToLower()
$rest = $RepoRoot.Path.Substring(2).Replace('\', '/')
$WSLRoot = "/mnt/$drive$rest"

Write-Host "Stopping ODIN Stack..." -ForegroundColor Yellow
wsl -u root -d $WSLDistro --cd "$WSLRoot" podman-compose -f podman-compose.wsl.yml down -v

Write-Host "`nRemaining containers:" -ForegroundColor Gray
podman ps -a
