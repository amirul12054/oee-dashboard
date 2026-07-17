import csv
import time
import random
import os
from datetime import datetime

# Configuration
OUTPUT_PATH = r"C:\MachineData\CNC01_output.csv"
MACHINE_NAME = "CNC-01"
IDEAL_RATE = 20  # units per hour
SHIFT_PLANNED_MINUTES = 480  # 8 hours

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

print(f"CSV Simulator started for {MACHINE_NAME}")
print(f"Writing to: {OUTPUT_PATH}")
print("Press Ctrl+C to stop\n")

shift_start = datetime.now()
total_units = 0
good_units = 0
downtime_minutes = 0

while True:
    # Simulate some randomness
    is_running = random.random() > 0.1  # 90% uptime
    units_this_cycle = random.randint(15, 20) if is_running else 0
    defects = random.randint(0, 2)
    
    total_units += units_this_cycle
    good_units += max(0, units_this_cycle - defects)
    
    elapsed_minutes = (datetime.now() - shift_start).seconds / 60
    run_time = elapsed_minutes - downtime_minutes
    
    # Calculate OEE components
    availability = run_time / max(elapsed_minutes, 1)
    actual_rate = (total_units / max(run_time / 60, 0.01))
    performance = actual_rate / IDEAL_RATE
    quality = good_units / max(total_units, 1)
    oee = availability * performance * quality * 100

    # Write CSV
    with open(OUTPUT_PATH, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["Date", "PlannedTime", "RunTime", "IdealRate", 
                         "ActualRate", "TotalUnits", "GoodUnits"])
        writer.writerow([
            datetime.now().strftime("%Y-%m-%d"),
            int(elapsed_minutes),
            int(run_time),
            IDEAL_RATE,
            round(actual_rate, 1),
            total_units,
            good_units
        ])
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] "
          f"Units: {total_units} | Good: {good_units} | "
          f"OEE: {oee:.1f}% | Running: {is_running}")
    
    time.sleep(10)  # Update every 10 seconds