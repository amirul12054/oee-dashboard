# Requires: pip install pymodbus
from pymodbus.server import StartTcpServer
from pymodbus.datastore import ModbusSequentialDataBlock, ModbusSlaveContext, ModbusServerContext
import threading
import time
import random
from datetime import datetime

# Setup Modbus data store
store = ModbusSlaveContext(
    hr=ModbusSequentialDataBlock(0, [0] * 200)
)
context = ModbusServerContext(slaves=store, single=True)

def simulate_data():
    total = 0
    good = 0
    print("Modbus Register Map:")
    print("  Register 100: Run Status (1=Running, 0=Stopped)")
    print("  Register 101: Total Units")
    print("  Register 102: Good Units")
    print("  Register 103: Fault Code")
    print("\nSimulating... Press Ctrl+C to stop\n")
    
    while True:
        is_running = random.random() > 0.1
        fault = 0 if is_running else random.choice([101, 102, 201])
        
        if is_running:
            new_units = random.randint(3, 5)
            defects = random.randint(0, 1)
            total += new_units
            good += new_units - defects

        # Write to registers 100-103
        store.setValues(3, 100, [
            1 if is_running else 0,
            total,
            good,
            fault
        ])

        print(f"[{datetime.now().strftime('%H:%M:%S')}] "
              f"Running: {is_running} | Units: {total} | "
              f"Good: {good} | Fault: {fault}")
        
        time.sleep(5)

# Run simulator in background thread
t = threading.Thread(target=simulate_data, daemon=True)
t.start()

print("Modbus TCP Server starting on port 502...")
print("Connect your OEE dashboard to:")
print("  IP: your-pc-ip-address")
print("  Port: 502")
print("  Slave ID: 1\n")

StartTcpServer(context=context, address=("0.0.0.0", 502))