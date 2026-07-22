"""
CSV production simulator — writes ONLY to a local CSV file, one new row
appended per simulated minute. No network calls, no direct upload to
Railway — you import the resulting file yourself via the dashboard's
"Import CSV" button, exactly like a real machine data export.

KEY FIX vs. the previous version: every row now reports the DELTA for that
one minute only (units made in just this minute, whether it ran this
minute or not) rather than a running cumulative total since shift start.
Your dashboard sums every imported row together for a given day, so
cumulative-per-row numbers get multiplied by however many rows you import
(480 rows/8hr shift -> ~480x over-count) and the rate math explodes when a
big cumulative total gets divided by a tiny elapsed time. Delta-per-row
avoids both problems: summing the deltas back up gives the correct daily
total, and each row's own rate is just that one minute's rate (0 or ~ideal
rate), which is exactly how the dashboard's own aggregation expects it.
"""

import csv
import os
import random
import time
from datetime import datetime, timedelta

# ==========================================
# CONFIGURATION
# ==========================================

OUTPUT_PATH = r"C:\Users\P3620\Documents\PROJECT\OEE Dashboard\FCT42_output.csv"

IDEAL_RATE = 120                 # units/hour
SHIFT_LENGTH_MINUTES = 8 * 60    # 8 hours

# Simulation speed: 5 = every 5 real seconds a new simulated minute happens.
# 60 = real time (1 simulated minute per 1 real minute).
SIMULATION_MINUTE_SECONDS = 5

# ==========================================

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

# Start a fresh file each run so you're not appending onto old test data.
with open(OUTPUT_PATH, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow([
        "Date", "PlannedTime", "RunTime", "IdealRate", "ActualRate", "TotalUnits", "GoodUnits"
    ])

shift_start = datetime.now()
minute_in_shift = 0
downtime_remaining = 0

print("=" * 60)
print("CSV Production Simulator (file-only, delta-per-row) Started")
print(f"Output     : {OUTPUT_PATH}")
print(f"Ideal Rate : {IDEAL_RATE} units/hour")
print(f"Simulation : 1 production minute = {SIMULATION_MINUTE_SECONDS} sec")
print("=" * 60)

while True:
    # New shift every 8 hours
    if minute_in_shift >= SHIFT_LENGTH_MINUTES:
        print("\n========== NEW SHIFT ==========\n")
        shift_start = datetime.now()
        minute_in_shift = 0

    minute_in_shift += 1

    # -------------------------------------
    # Downtime simulation (same logic as your script)
    # -------------------------------------
    if downtime_remaining > 0:
        machine_running = False
        downtime_remaining -= 1
    else:
        machine_running = True
        if random.random() < 0.03:  # ~3% chance per minute of stopping
            if random.random() < 0.80:
                downtime_remaining = random.randint(1, 3)   # micro stop
            else:
                downtime_remaining = random.randint(5, 10)  # bigger stop
            machine_running = False

    # -------------------------------------
    # Production for THIS MINUTE ONLY (delta, not cumulative)
    # -------------------------------------
    if machine_running:
        run_this_minute = 1
        performance = random.uniform(0.90, 1.05)  # 90-105% of ideal
        actual_rate = round(IDEAL_RATE * performance, 1)  # units/hour equivalent for this minute

        units_this_minute = round(actual_rate / 60)
        units_this_minute += random.choice([-1, 0, 0, 0, 1])
        units_this_minute = max(units_this_minute, 0)

        defect_rate = random.uniform(0.0, 0.02)  # 0-2% defects
        defects = round(units_this_minute * defect_rate)
        good_this_minute = max(0, units_this_minute - defects)
    else:
        run_this_minute = 0
        actual_rate = 0
        units_this_minute = 0
        good_this_minute = 0

    timestamp = shift_start + timedelta(minutes=minute_in_shift)

    row = [
        timestamp.strftime("%Y-%m-%d %H:%M"),
        1,                    # PlannedTime: this row represents exactly 1 minute
        run_this_minute,      # RunTime: 1 if it ran this minute, 0 if stopped
        IDEAL_RATE,
        actual_rate,
        units_this_minute,    # delta for this minute, NOT cumulative
        good_this_minute,     # delta for this minute, NOT cumulative
    ]

    with open(OUTPUT_PATH, "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(row)

    # This-minute-only stats for the console (naturally sane numbers now,
    # since it's not dividing a cumulative total by a tiny elapsed time)
    availability = run_this_minute * 100
    performance_pct = (actual_rate / IDEAL_RATE * 100) if machine_running else 0
    quality_pct = (good_this_minute / units_this_minute * 100) if units_this_minute else 100
    oee = availability / 100 * performance_pct / 100 * quality_pct / 100 * 100

    status = "RUNNING" if machine_running else "STOPPED"
    print(
        f"{timestamp.strftime('%H:%M')} | {status:8} | "
        f"Rate {actual_rate:6.1f}/hr | Units +{units_this_minute:2d} | Good +{good_this_minute:2d} | "
        f"OEE(this min) {oee:5.1f}%"
    )

    time.sleep(SIMULATION_MINUTE_SECONDS)
