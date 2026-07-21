using System.Net;
using FluentModbus;
using Microsoft.EntityFrameworkCore;

// NOTE ON PACKAGE VERSION SENSITIVITY:
// Written against FluentModbus's commonly-documented API shape from memory
// (ModbusTcpClient.Connect / ReadHoldingRegisters<T>). I could not run
// `dotnet restore`/`dotnet build` in this sandbox (no network access) to
// confirm exact overloads for your installed version — please build locally
// after adding the package and check https://github.com/Apollo3zehn/FluentModbus
// if the compiler flags a signature mismatch.

public class ModbusPollingService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly MachineStateStore _stateStore;
    private readonly ILogger<ModbusPollingService> _logger;
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(10);

    public ModbusPollingService(IServiceScopeFactory scopeFactory, MachineStateStore stateStore, ILogger<ModbusPollingService> logger)
    {
        _scopeFactory = scopeFactory;
        _stateStore = stateStore;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PollAllMachinesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Modbus polling loop failed");
            }

            try { await Task.Delay(PollInterval, stoppingToken); } catch (OperationCanceledException) { break; }
        }
    }

    private async Task PollAllMachinesAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<OeeDbContext>();

        var machines = await db.Machines
            .Where(m => m.ConnectionType == "Modbus" && m.ModbusIp != null)
            .ToListAsync(ct);

        foreach (var machine in machines)
        {
            await PollOneMachineAsync(db, machine, ct);
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task PollOneMachineAsync(OeeDbContext db, MachineEntity machine, CancellationToken ct)
    {
        var state = _stateStore.GetOrAdd(machine.Id);
        var client = new ModbusTcpClient();

        try
        {
            var ip = IPAddress.Parse(machine.ModbusIp!);
            client.Connect(new IPEndPoint(ip, machine.ModbusPort));

            byte unitId = (byte)machine.ModbusSlaveId;
            bool? runStatus = null;
            long? unitCount = null;
            long? goodUnits = null;
            bool faultStatus = false;

            if (machine.ModbusRegRunStatus.HasValue)
                runStatus = ReadRegister(client, unitId, machine.ModbusRegRunStatus.Value) != 0;

            if (machine.ModbusRegUnitCount.HasValue)
                unitCount = ReadRegister(client, unitId, machine.ModbusRegUnitCount.Value);

            if (machine.ModbusRegGoodUnits.HasValue)
                goodUnits = ReadRegister(client, unitId, machine.ModbusRegGoodUnits.Value);

            if (machine.ModbusRegFaultStatus.HasValue)
                faultStatus = ReadRegister(client, unitId, machine.ModbusRegFaultStatus.Value) != 0;

            LiveReadingProcessor.RecordSample(state, runStatus ?? false, unitCount, goodUnits);

            if (runStatus.HasValue) machine.IsRunning = runStatus.Value;
            machine.LastConnectedAt = DateTime.UtcNow;
            machine.LastConnectionError = faultStatus ? "Machine reports fault status" : null;
        }
        catch (Exception ex)
        {
            machine.LastConnectionError = ex.Message;
            _logger.LogWarning(ex, "Modbus poll failed for machine {MachineId} ({Ip})", machine.Id, machine.ModbusIp);
        }
        finally
        {
            try { client.Disconnect(); } catch { /* best-effort cleanup */ }
        }

        // Flush a snapshot into OeeReadings every SnapshotIntervalMinutes.
        if ((DateTime.UtcNow - state.SnapshotStartUtc).TotalMinutes >= Math.Max(1, machine.SnapshotIntervalMinutes))
        {
            var reading = LiveReadingProcessor.BuildSnapshotAndReset(state, machine.Id, machine.IdealRate);
            if (reading != null) db.OeeReadings.Add(reading);
        }
    }

    // Single 16-bit holding register read. NOTE: if your PLC exposes 32-bit
    // counters across two registers, this needs extending (read count=2 and
    // combine high/low words) — flag your register map and I can adjust this.
    private static ushort ReadRegister(ModbusTcpClient client, byte unitId, int address)
    {
        var regs = client.ReadHoldingRegisters<ushort>(unitId, (ushort)address, 1);
        return regs[0];
    }
}
