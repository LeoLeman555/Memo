$ErrorActionPreference = "Stop"

function Info($msg) {
  Write-Host "[INFO]  $msg" -ForegroundColor Cyan
}

function Success($msg) {
  Write-Host "[OK]    $msg" -ForegroundColor Green
}

function Warn($msg) {
  Write-Host "[WARN]  $msg" -ForegroundColor Yellow
}

function Fail($msg) {
  Write-Host "[ERROR] $msg" -ForegroundColor Red
  exit 1
}

Write-Host "=== Talking Box | ESP32 Firmware Deployment ===" -ForegroundColor Magenta

# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------
$FirmwarePath = "firmware/src"
$Files = @(
  "ble.py",
  "audio.py",
  "storage.py",
  "rtc.py",
  "scheduler.py",
  "logger.py",
  "battery.py",
  "sdcard.py",
  "start.py"
)

# Known USB-UART VID:PID commonly used by ESP32 boards
$KnownEspUsbIds = @(
  "1a86:7523", # CH340
  "10c4:ea60", # CP210x
  "0403:6001"  # FTDI
)

# ------------------------------------------------------------------
# Pre-flight checks
# ------------------------------------------------------------------
Info "Checking mpremote availability..."
if (-not (Get-Command mpremote -ErrorAction SilentlyContinue)) {
  Fail "mpremote is not installed or not available in PATH."
}
Success "mpremote found"

Info "Checking firmware files..."
foreach ($file in $Files) {
  $fullPath = Join-Path $FirmwarePath $file
  if (-not (Test-Path $fullPath)) {
    Fail "Missing firmware file: $fullPath"
  }
}
Success "All firmware files are present"

# ------------------------------------------------------------------
# Device detection (source of truth: mpremote)
# ------------------------------------------------------------------
Info "Detecting devices via mpremote..."
$devLines = mpremote devs 2>$null
if (-not $devLines) {
  Fail "No devices detected by mpremote."
}

$devices = @()
foreach ($line in $devLines) {
  if ($line -match '^(COM\d+)\s+([0-9a-fA-F:]+)\s+(.+?)\s') {
    $devices += [PSCustomObject]@{
      Port        = $matches[1]
      UsbId       = $matches[2]
      Vendor      = $matches[3]
      IsLikelyEsp = $KnownEspUsbIds -contains $matches[2]
    }
  }
}

if ($devices.Count -eq 0) {
  Fail "Unable to parse mpremote device list."
}

# ------------------------------------------------------------------
# Port selection
# ------------------------------------------------------------------
$preferred = $devices | Where-Object { $_.IsLikelyEsp }

if ($preferred.Count -eq 1) {
  $ComPort = $preferred[0].Port
  Success "ESP32 auto-detected: $ComPort ($($preferred[0].UsbId))"
} else {
  Info "Available serial devices:"
  for ($i = 0; $i -lt $devices.Count; $i++) {
    $flag = if ($devices[$i].IsLikelyEsp) { "ESP?" } else { "" }
    Write-Host "[$i] $($devices[$i].Port)  $($devices[$i].UsbId)  $flag"
  }

  $inputValue = Read-Host "Select ESP32 COM port (index or COMx)"

  # Case 1: index
  if ($inputValue -match '^\d+$') {
    $idx = [int]$inputValue
    if ($idx -ge $devices.Count) {
      Fail "Index out of range."
    }
    $ComPort = $devices[$idx].Port
  }
  # Case 2: COMx
  elseif ($inputValue -match '^COM\d+$') {
    $match = $devices | Where-Object { $_.Port -ieq $inputValue }
    if (-not $match) {
      Fail "COM port $inputValue not found in detected devices."
    }
    $ComPort = $match.Port
  }
  else {
    Fail "Invalid input. Use index (e.g. 0) or port name (e.g. COM11)."
  }

  Success "Selected port: $ComPort"
}

# ------------------------------------------------------------------
# Connection test (hard gate)
# ------------------------------------------------------------------
Info "Testing connection to $ComPort..."
try {
  mpremote connect $ComPort ls > $null
} catch {
  Fail "Unable to communicate with device on $ComPort. Port may be busy or not an ESP32."
}
Success "Connection successful"

# ------------------------------------------------------------------
# Deployment confirmation
# ------------------------------------------------------------------
Info "Deployment summary:"
Write-Host "  Target device : $ComPort"
Write-Host "  Firmware path : $FirmwarePath"
Write-Host "  Files to transfer (in order):"

foreach ($file in $Files) {
  Write-Host "   - $file"
}

$confirm = Read-Host "Proceed with deployment? (y/N)"
if ($confirm -notmatch '^(y|yes)$') {
  Warn "Deployment aborted by user."
  exit 0
}

Success "Deployment confirmed"


# ------------------------------------------------------------------
# Deployment
# ------------------------------------------------------------------
Info "Starting firmware deployment..."
foreach ($file in $Files) {
  $source = Join-Path $FirmwarePath $file
  $target = ":$file"

  Info "Copying $file"
  mpremote connect $ComPort cp $source $target
}
Success "All files successfully copied"

# ------------------------------------------------------------------
# Reset
# ------------------------------------------------------------------
Info "Resetting ESP32..."
mpremote connect $ComPort reset
Success "ESP32 reset completed"


# ------------------------------------------------------------------
# Optional RTC update (offline, host-driven)
# ------------------------------------------------------------------
$setRtc = Read-Host "Update RTC time from host clock? (y/N)"
if ($setRtc -match '^(y|yes)$') {

  Info "Updating RTC from host system time..."

  $dt = Get-Date

  # .NET: Sunday=0 → MicroPython: Monday=0
  $weekday = ($dt.DayOfWeek.value__ + 6) % 7

  $python = "from rtc import TimeRead; " +
            "rtc=TimeRead(); " +
            "rtc.set_datetime(" +
            "$($dt.Year),$($dt.Month),$($dt.Day)," +
            "$weekday,$($dt.Hour),$($dt.Minute),$($dt.Second)); " +
            "print('RTC updated successfully.')"

  try {
    mpremote connect $ComPort exec $python
    if ($LASTEXITCODE -ne 0) {
      throw 'RTC python execution failed'
    }
    Success "RTC successfully updated"
  }
  catch {
    Fail "RTC update failed"
  }
}
else {
  Info "RTC update skipped"
}

Write-Host "Deployment completed successfully." -ForegroundColor Green
