import json
import subprocess
from pathlib import Path
from typing import List, Dict

import pandas as pd
import matplotlib.pyplot as plt


# -----------------------------
# CONFIG
# -----------------------------
LOG_LOCAL_PATH = Path("battery.log")
LOG_REMOTE_PATH = ":flash/logs/battery.log"


# -----------------------------
# DATA ACQUISITION
# -----------------------------
def fetch_log_if_needed() -> Path:
    """Fetch log locally or from ESP via mpremote."""
    print("[INFO] Checking local log file...")

    if LOG_LOCAL_PATH.exists():
        print("[INFO] Local log found.")
        return LOG_LOCAL_PATH

    print("[INFO] Fetching log from device...")

    result = subprocess.run(
        ["mpremote", "fs", "cat", LOG_REMOTE_PATH],
        capture_output=True,
        text=True,
        check=True
    )

    LOG_LOCAL_PATH.write_text(result.stdout)
    print("[INFO] Log retrieved and saved locally.")
    return LOG_LOCAL_PATH


# -----------------------------
# PARSING
# -----------------------------
def parse_log(file_path: Path) -> pd.DataFrame:
    """Parse ESP JSON log."""
    print("[INFO] Parsing log file...")

    records: List[Dict] = []

    with file_path.open("r") as f:
        for line in f:
            try:
                data = json.loads(line.strip())
                records.append({
                    "time": data.get("time"),
                    "percent": data.get("percent")
                })
            except json.JSONDecodeError:
                continue

    df = pd.DataFrame(records)
    df = df.dropna(subset=["time"]).sort_values("time")

    print(f"[INFO] Loaded {len(df)} valid samples.")
    return df


# -----------------------------
# PROCESSING
# -----------------------------
def process_signal(df: pd.DataFrame, step_s: int = 300) -> pd.DataFrame:
    """Build scientific time series with interpolation + state detection."""
    print("[INFO] Processing signal...")

    df = df.copy()

    # Time index
    df["datetime"] = pd.to_datetime(df["time"], unit="s")
    df = df.set_index("datetime")

    # Regular sampling (measurement grid)
    res = df[["percent"]].resample(f"{step_s}s").mean()

    # Real vs missing data mask
    res["is_real"] = ~res["percent"].isna()

    # Interpolation ONLY for visualization
    res["interp"] = res["percent"].interpolate(method="linear")

    # Charging detection (heuristic)
    res["is_charging"] = res["interp"] >= 100

    # Time axis (scientific formatting)
    start = res.index[0]
    elapsed_s = (res.index - start).total_seconds()

    if elapsed_s.max() < 3600:
        res["t"] = elapsed_s / 60
        res.attrs["unit"] = "minutes"
    else:
        res["t"] = elapsed_s / 3600
        res.attrs["unit"] = "hours"

    print("[INFO] Processing complete.")
    return res


# -----------------------------
# SEGMENTED PLOTTING ENGINE
# -----------------------------
def plot_segments(ax, x, y, mask, color, label, lw=2):
    """Plot continuous segments based on boolean mask."""
    start = None
    first = True

    for i in range(len(mask)):
        if mask[i] and start is None:
            start = i
        elif not mask[i] and start is not None:
            ax.plot(
                x[start:i],
                y[start:i],
                color=color,
                linewidth=lw,
                label=label if first else None
            )
            first = False
            start = None

    if start is not None:
        ax.plot(
            x[start:],
            y[start:],
            color=color,
            linewidth=lw,
            label=label if first else None
        )


# -----------------------------
# PLOT
# -----------------------------
def plot(df: pd.DataFrame):
    print("[INFO] Generating scientific plot...")

    fig, ax = plt.subplots(figsize=(12, 6))

    x = df["t"].values
    y_real = df["percent"].values
    y_interp = df["interp"].values

    is_real = df["is_real"].values
    is_missing = ~is_real
    is_charge = df["is_charging"].values
    is_normal = ~is_charge

    # -------------------------
    # REAL MEASUREMENTS (RED)
    # -------------------------
    plot_segments(ax, x, y_real, is_real, "red", "Measured data")

    # -------------------------
    # INTERPOLATION (ORANGE)
    # -------------------------
    plot_segments(ax, x, y_interp, is_missing, "orange", "Signal loss (interpolation)")

    # -------------------------
    # CHARGING / FULL (GREEN)
    # -------------------------
    plot_segments(ax, x, y_interp, is_charge, "green", "Charging / Full battery")

    # -------------------------
    # AXES
    # -------------------------
    ax.set_xlabel(f"Time ({df.attrs['unit']})")
    ax.set_ylabel("Battery level (%)")
    ax.set_ylim(0, 110)

    ax.grid(True, alpha=0.3)
    ax.legend()

    plt.title("Battery analysis – ESP system")
    plt.tight_layout()

    plt.show()

    print("[INFO] Plot displayed successfully.")


# -----------------------------
# MAIN PIPELINE
# -----------------------------
def main():
    print("[START] Battery analysis pipeline")

    log_path = fetch_log_if_needed()
    df = parse_log(log_path)
    processed = process_signal(df, 60)

    plot(processed)

    print("[DONE]")


if __name__ == "__main__":
    main()