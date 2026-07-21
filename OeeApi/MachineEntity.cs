public class MachineEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public bool IsRunning { get; set; }
    public int UnitsProduced { get; set; }
    public int GoodUnits { get; set; }
    public int PlannedTimeMinutes { get; set; }
    public int RunTimeMinutes { get; set; }
    public int IdealRate { get; set; }
    public int ActualRate { get; set; }

    // Connection type: CSV, OPCUA, Modbus
    public string ConnectionType { get; set; } = "CSV";

    // OPC-UA settings
    public string? OpcUaEndpoint { get; set; }
    public int OpcUaNamespace { get; set; } = 2;
    public string? OpcUaNodeRunStatus { get; set; }
    public string? OpcUaNodeUnitCount { get; set; }
    public string? OpcUaNodeGoodUnits { get; set; }
    public string? OpcUaNodeFaultStatus { get; set; }

    // Modbus settings
    public string? ModbusIp { get; set; }
    public int ModbusPort { get; set; } = 502;
    public int ModbusSlaveId { get; set; } = 1;
    public int? ModbusRegRunStatus { get; set; }
    public int? ModbusRegUnitCount { get; set; }
    public int? ModbusRegGoodUnits { get; set; }
    public int? ModbusRegFaultStatus { get; set; }

    // CSV settings
    public string? CsvFilePath { get; set; }
    public bool CsvAutoImport { get; set; } = false;

    // Live polling (OPC-UA / Modbus) settings & health
    public int SnapshotIntervalMinutes { get; set; } = 5;
    public DateTime? LastConnectedAt { get; set; }
    public string? LastConnectionError { get; set; }

    // Product / changeover tracking
    public int? CurrentProductId { get; set; }
}