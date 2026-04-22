[CmdletBinding()]
param(
  [string]$FirmwarePath = "firmware/src",
  [string[]]$Files = @(
    "ble.py","audio.py","storage.py","rtc.py",
    "scheduler.py","logger.py","battery.py",
    "sdcard.py","start.py"
  ),
  [string]$Port,
  [switch]$AutoSelect,
  [switch]$Force,
  [switch]$SetRTC,
  [string]$LogFile = "logs/deploy.log"
)

$ErrorActionPreference = "Stop"

# ------------------------------------------------------------------
# Logging
# ------------------------------------------------------------------
function Log($level, $msg) {
  $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  $line = "[$timestamp][$level] $msg"

  switch ($level) {
    "INFO"  { Write-Host $line -ForegroundColor Cyan }
    "OK"    { Write-Host $line -ForegroundColor Green }
    "WARN"  { Write-Host $line -ForegroundColor Yellow }
    "ERROR" { Write-Host $line -ForegroundColor Red }
  }

  Add-Content -Path $LogFile -Value $line
}

function Fail($msg) {
  Log "ERROR" $msg
  exit 1
}

# ------------------------------------------------------------------
# USB IDs ESP32
# ------------------------------------------------------------------
$KnownEspUsbIds = @(
  "1a86:7523","10c4:ea60","0403:6001"
)

# ------------------------------------------------------------------
# Pre-flight
# ------------------------------------------------------------------
Log "INFO" "Checking mpremote..."
if (-not (Get-Command mpremote -ErrorAction SilentlyContinue)) {
  Fail "mpremote not found in PATH"
}
Log "OK" "mpremote available"

Log "INFO" "Validating firmware files..."
foreach ($file in $Files) {
  $path = Join-Path $FirmwarePath $file
  if (-not (Test-Path $path)) {
    Fail "Missing file: $path"
  }
}
Log "OK" "All files present"

# ------------------------------------------------------------------
# Device detection
# ------------------------------------------------------------------
if (-not $Port) {

  Log "INFO" "Detecting devices..."
  $devLines = mpremote devs 2>$null

  if (-not $devLines) {
    Fail "No devices detected"
  }

  $devices = @()

  foreach ($line in $devLines) {
    if ($line -match '^(COM\d+)\s+([0-9a-fA-F:]+)\s+(.+?)\s') {
      $devices += [PSCustomObject]@{
        Port  = $matches[1]
        UsbId = $matches[2]
        IsEsp = $KnownEspUsbIds -contains $matches[2]
      }
    }
  }

  if ($devices.Count -eq 0) {
    Fail "Unable to parse device list"
  }

  $esp = $devices | Where-Object { $_.IsEsp }

  if ($AutoSelect -and $esp.Count -ge 1) {
    $Port = $esp[0].Port
    Log "OK" "Auto-selected ESP32: $Port"
  }
  elseif ($esp.Count -eq 1) {
    $Port = $esp[0].Port
    Log "OK" "ESP32 detected: $Port"
  }
  else {
    Log "INFO" "Available devices:"
    for ($i=0; $i -lt $devices.Count; $i++) {
      Write-Host "[$i] $($devices[$i].Port) $($devices[$i].UsbId)"
    }

    $choice = Read-Host "Select index"
    if ($choice -notmatch '^\d+$') {
      Fail "Invalid selection"
    }

    $Port = $devices[[int]$choice].Port
  }
}

# ------------------------------------------------------------------
# Connection test
# ------------------------------------------------------------------
Log "INFO" "Testing connection on $Port..."
try {
  mpremote connect $Port ls > $null
} catch {
  Fail "Connection failed on $Port"
}
Log "OK" "Connection successful"

# ------------------------------------------------------------------
# Confirmation (skipped in CI / web)
# ------------------------------------------------------------------
if (-not $Force) {
  Log "INFO" "Deployment summary:"
  Write-Host "Port: $Port"
  Write-Host "Files: $($Files -join ', ')"

  $confirm = Read-Host "Proceed? (y/N)"
  if ($confirm -notmatch '^(y|yes)$') {
    Log "WARN" "Deployment aborted"
    exit 0
  }
}

# ------------------------------------------------------------------
# Deployment
# ------------------------------------------------------------------
Log "INFO" "Starting deployment..."

foreach ($file in $Files) {
  $src = Join-Path $FirmwarePath $file
  $dst = ":$file"

  try {
    Log "INFO" "Copying $file"
    mpremote connect $Port cp $src $dst
  } catch {
    Fail "Failed to copy $file"
  }
}

Log "OK" "Files deployed"

# ------------------------------------------------------------------
# Reset
# ------------------------------------------------------------------
Log "INFO" "Resetting device..."
mpremote connect $Port reset
Start-Sleep -Seconds 2
Log "OK" "Reset done"

# ------------------------------------------------------------------
# RTC
# ------------------------------------------------------------------
if ($SetRTC) {
  Log "INFO" "Updating RTC..."

  $dt = Get-Date
  $weekday = ($dt.DayOfWeek.value__ + 6) % 7

  $py = "from rtc import TimeRead; " +
            "rtc=TimeRead(); " +
            "rtc.set_datetime(" +
            "$($dt.Year),$($dt.Month),$($dt.Day)," +
            "$weekday,$($dt.Hour),$($dt.Minute),$($dt.Second)); "

  try {
    mpremote connect $Port exec $py
    if ($LASTEXITCODE -ne 0) {
      throw 'RTC python execution failed'
    }
    Log "OK" "RTC updated"
  } catch {
    Fail "RTC update failed"
  }
}

Log "OK" "Deployment completed"