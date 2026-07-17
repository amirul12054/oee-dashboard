# Requires: pip install opcua
from opcua import Server
import time
import random
from datetime import datetime

server = Server()
server.set_endpoint("opc.tcp://0.0.0.0:4840/freeopcua/server/")
server.set_server_name("OEE Machine Simulator")

uri = "http://oee.simulator"
idx = server.register_namespace(uri)

objects = server.get_objects_node()
machine = objects.add_object(idx, "Machine1")

# Create OEE tags
run_status = machine.add_variable(idx, "RunStatus", 1)
unit_count = machine.add_variable(idx, "TotalCount", 0)
good_count = machine.add_variable(idx, "GoodCount", 0)
fault_code = machine.add_variable(idx, "FaultCode", 0)

run_status.set_writable()
unit_count.set_writable()
good_count.set_writable()
fault_code.set_writable()

server.start()
print("OPC-UA Server started at opc.tcp://localhost:4840")
print("Node IDs:")
print(f"  Run Status:  ns={idx};s=Machine1.RunStatus")
print(f"  Unit Count:  ns={idx};s=Machine1.TotalCount")
print(f"  Good Count:  ns={idx};s=Machine1.GoodCount")
print(f"  Fault Code:  ns={idx};s=Machine1.FaultCode")
print("\nSimulating live machine data... Press Ctrl+C to stop\n")

total = 0
good = 0

try:
    while True:
        is_running = random.random() > 0.1
        fault = 0 if is_running else random.choice([1001, 1002, 2001])
        
        if is_running:
            new_units = random.randint(3, 5)
            defects = random.randint(0, 1)
            total += new_units
            good += new_units - defects

        run_status.set_value(1 if is_running else 0)
        unit_count.set_value(total)
        good_count.set_value(good)
        fault_code.set_value(fault)

        print(f"[{datetime.now().strftime('%H:%M:%S')}] "
              f"Running: {is_running} | Units: {total} | "
              f"Good: {good} | Fault: {fault}")
        
        time.sleep(5)
except KeyboardInterrupt:
    server.stop()
    print("OPC-UA Server stopped")