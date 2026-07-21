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

# Simulation speed
# 5 = every 5 seconds a new production minute is generated
# 60 = real time
SIMULATION_MINUTE_SECONDS = 5

# ==========================================

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

# Create CSV with header if it doesn't exist
if not os.path.exists(OUTPUT_PATH):
    with open(OUTPUT_PATH, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Date",
            "PlannedTime",
            "RunTime",
            "IdealRate",
            "ActualRate",
            "TotalUnits",
            "GoodUnits"
        ])

shift_start = datetime.now()

planned_minutes = 0
run_minutes = 0

total_units = 0
good_units = 0

downtime_remaining = 0

print("=" * 60)
print("CSV Production Simulator Started")
print(f"Output : {OUTPUT_PATH}")
print(f"Ideal Rate : {IDEAL_RATE} units/hour")
print(f"Simulation : 1 production minute = {SIMULATION_MINUTE_SECONDS} sec")
print("=" * 60)

while True:

    # New shift every 8 hours
    if planned_minutes >= SHIFT_LENGTH_MINUTES:

        print("\n========== NEW SHIFT ==========\n")

        shift_start = datetime.now()

        planned_minutes = 0
        run_minutes = 0

        total_units = 0
        good_units = 0

    planned_minutes += 1

    # -------------------------------------
    # Downtime simulation
    # -------------------------------------

    if downtime_remaining > 0:
        machine_running = False
        downtime_remaining -= 1

    else:
        machine_running = True

        # Around 3% chance every minute of stopping
        if random.random() < 0.03:

            # Mostly micro stops
            if random.random() < 0.80:
                downtime_remaining = random.randint(1, 3)

            # Occasionally bigger stop
            else:
                downtime_remaining = random.randint(5, 10)

            machine_running = False

    # -------------------------------------
    # Production
    # -------------------------------------

    if machine_running:

        run_minutes += 1

        # Performance between 90~105%
        performance = random.uniform(0.90, 1.05)

        actual_rate = round(IDEAL_RATE * performance, 1)

        # Units produced this minute
        units_this_minute = round(actual_rate / 60)

        # Small random variation
        units_this_minute += random.choice([-1, 0, 0, 0, 1])

        units_this_minute = max(units_this_minute, 0)

        total_units += units_this_minute

        # 0~2% defects
        defect_rate = random.uniform(0.0, 0.02)

        defects = round(units_this_minute * defect_rate)

        good_units += units_this_minute - defects

    else:

        actual_rate = 0

    # -------------------------------------
    # Save CSV
    # -------------------------------------

    timestamp = shift_start + timedelta(minutes=planned_minutes)

    row = [

        timestamp.strftime("%Y-%m-%d %H:%M"),

        planned_minutes,

        run_minutes,

        IDEAL_RATE,

        actual_rate,

        total_units,

        good_units
    ]

    with open(OUTPUT_PATH, "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(row)

    availability = run_minutes / planned_minutes

    performance_pct = actual_rate / IDEAL_RATE if machine_running else 0

    quality = good_units / total_units if total_units else 1

    oee = availability * performance_pct * quality * 100

    status = "RUNNING" if machine_running else "STOPPED"

    print(
        f"{timestamp.strftime('%H:%M')} | "
        f"{status:8} | "
        f"Plan {planned_minutes:3d}m | "
        f"Run {run_minutes:3d}m | "
        f"Rate {actual_rate:6.1f}/hr | "
        f"Units {total_units:4d} | "
        f"Good {good_units:4d} | "
        f"OEE {oee:5.1f}%"
    )

    time.sleep(SIMULATION_MINUTE_SECONDS)