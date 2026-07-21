"""
CSV "auto-import" simulator — pushes to your real deployed API.

Your original simulate_csv.py only wrote to a local file. Nothing in the
backend watches that file (CsvAutoImport/CsvFilePath are saved to the DB but
nothing reads them), and even if something did, your Railway-hosted backend
has no way to read a file sitting on your C: drive anyway — same reason
Modbus/OPC-UA need a local-to-cloud push instead of cloud-to-local pull.

So this version keeps writing the local file (useful to eyeball what it's
generating) AND pushes the same row straight to /import/process on your
real API, the same way a proper "auto-import agent" would.

Setup:
    pip install requests
Edit the CONFIG block, then just run it and leave it going.
"""

import csv
import io
import time
import random
import os
from datetime import datetime
import requests

# ============ CONFIG ============
API_URL = "https://oee-dashboard-production.up.railway.app"
USERNAME = "admin"
PASSWORD = "CHANGE_ME"
MACHINE_ID = 1          # the machine ID this simulator represents (check GET /machines)
SHIFT = "Live-CSV"      # just a label; ShiftName (Morning/Night) is auto-detected from the timestamp

OUTPUT_PATH = r"C:\MachineData\CNC01_output.csv"
IDEAL_RATE = 20  # units per hour
PUSH_INTERVAL_SECONDS = 10
# =================================

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)


def login():
    r = requests.post(f"{API_URL}/auth/login", json={"Username": USERNAME, "Password": PASSWORD})
    r.raise_for_status()
    return r.json()["token"]


def push_row(token, row):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Date", "PlannedTime", "RunTime", "IdealRate", "ActualRate", "TotalUnits", "GoodUnits"])
    w.writerow(row)
    csv_bytes = buf.getvalue().encode("utf-8")

    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": ("reading.csv", csv_bytes, "text/csv")}
    data = {
        "machineId": str(MACHINE_ID),
        "shift": SHIFT,
        "colDate": "0", "colPlanned": "1", "colRunTime": "2",
        "colIdealRate": "3", "colActualRate": "4", "colTotalUnits": "5", "colGoodUnits": "6",
    }
    r = requests.post(f"{API_URL}/import/process", headers=headers, files=files, data=data)
    r.raise_for_status()
    return r.json()


print(f"CSV auto-import simulator started for machine ID {MACHINE_ID}")
print(f"Local copy: {OUTPUT_PATH}")
print(f"Pushing to: {API_URL}/import/process every {PUSH_INTERVAL_SECONDS}s")
print("Press Ctrl+C to stop\n")

token = login()
shift_start = datetime.now()
total_units = 0
good_units = 0
downtime_minutes = 0

while True:
    is_running = random.random() > 0.1  # 90% uptime
    units_this_cycle = random.randint(15, 20) if is_running else 0
    defects = random.randint(0, 2)

    total_units += units_this_cycle
    good_units += max(0, units_this_cycle - defects)

    elapsed_minutes = (datetime.now() - shift_start).seconds / 60
    run_time = elapsed_minutes - downtime_minutes

    availability = run_time / max(elapsed_minutes, 1)
    actual_rate = total_units / max(run_time / 60, 0.01)
    performance = actual_rate / IDEAL_RATE
    quality = good_units / max(total_units, 1)
    oee = availability * performance * quality * 100

    row = [
        datetime.now().strftime("%Y-%m-%d %H:%M"),
        int(elapsed_minutes),
        int(run_time),
        IDEAL_RATE,
        round(actual_rate, 1),
        total_units,
        good_units,
    ]

    # keep a local copy for your own reference
    with open(OUTPUT_PATH, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Date", "PlannedTime", "RunTime", "IdealRate", "ActualRate", "TotalUnits", "GoodUnits"])
        w.writerow(row)

    try:
        result = push_row(token, row)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Units: {total_units} | Good: {good_units} | "
              f"OEE: {oee:.1f}% | Running: {is_running} -> imported {result.get('imported')} row")
    except requests.HTTPError as e:
        print(f"Push failed: {e}")
        if e.response is not None and e.response.status_code == 401:
            token = login()

    time.sleep(PUSH_INTERVAL_SECONDS)
