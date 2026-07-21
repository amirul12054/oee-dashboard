using System.Collections.Concurrent;

/// <summary>
/// Tracks live run-status/counter samples for one machine between snapshot
/// flushes. Uptime is integrated properly (time-weighted between status
/// changes) rather than guessed from a single sample per period, so
/// Availability reflects actual measured runtime.
/// </summary>
public class LiveMachineState
{
    public bool LastRunStatus { get; set; }
    public DateTime LastStatusChangeUtc { get; set; } = DateTime.UtcNow;
    public double AccumulatedRunSeconds { get; set; }
    public DateTime SnapshotStartUtc { get; set; } = DateTime.UtcNow;

    public long? LastUnitCount { get; set; }
    public long? LastGoodUnits { get; set; }
    public long SnapshotStartUnitCount { get; set; }
    public long SnapshotStartGoodUnits { get; set; }

    private readonly object _lock = new();
    public object Lock => _lock;
}

/// <summary>
/// Singleton store of per-machine live state, shared by the Modbus and
/// OPC-UA background pollers.
/// </summary>
public class MachineStateStore
{
    private readonly ConcurrentDictionary<int, LiveMachineState> _states = new();

    public LiveMachineState GetOrAdd(int machineId) =>
        _states.GetOrAdd(machineId, _ => new LiveMachineState());
}

public static class LiveReadingProcessor
{
    /// <summary>
    /// Called every time a fresh sample (poll or subscription notification)
    /// comes in for a machine. Integrates uptime for the elapsed time since
    /// the last sample based on the *previous* run status, then updates to
    /// the new status/counters.
    /// </summary>
    public static void RecordSample(LiveMachineState state, bool runStatus, long? unitCount, long? goodUnits)
    {
        lock (state.Lock)
        {
            var now = DateTime.UtcNow;
            if (state.LastRunStatus)
                state.AccumulatedRunSeconds += (now - state.LastStatusChangeUtc).TotalSeconds;

            state.LastStatusChangeUtc = now;
            state.LastRunStatus = runStatus;

            if (unitCount.HasValue)
            {
                if (state.LastUnitCount == null) state.SnapshotStartUnitCount = unitCount.Value;
                state.LastUnitCount = unitCount;
            }
            if (goodUnits.HasValue)
            {
                if (state.LastGoodUnits == null) state.SnapshotStartGoodUnits = goodUnits.Value;
                state.LastGoodUnits = goodUnits;
            }
        }
    }

    /// <summary>
    /// Flushes the accumulated period into an OeeReading and resets counters
    /// for the next snapshot window. Returns null if nothing has been
    /// sampled yet for this machine (e.g. just started, no data received).
    /// </summary>
    public static OeeReadingEntity? BuildSnapshotAndReset(
        LiveMachineState state, int machineId, int idealRate,
        List<ShiftDefinitionEntity>? shiftDefs = null,
        int? productId = null, int changeoverMinutes = 0)
    {
        lock (state.Lock)
        {
            if (state.LastUnitCount == null && state.LastGoodUnits == null && state.AccumulatedRunSeconds == 0 && !state.LastRunStatus)
                return null;

            var nowUtc = DateTime.UtcNow;
            // Fold in run time up to right now for whatever status we're currently in.
            if (state.LastRunStatus)
                state.AccumulatedRunSeconds += (nowUtc - state.LastStatusChangeUtc).TotalSeconds;
            state.LastStatusChangeUtc = nowUtc;

            var plannedMinutes = (int)Math.Round((nowUtc - state.SnapshotStartUtc).TotalMinutes);
            if (plannedMinutes <= 0) plannedMinutes = 1;

            var runMinutes = (int)Math.Round(state.AccumulatedRunSeconds / 60.0);
            runMinutes = Math.Min(runMinutes, plannedMinutes);

            var totalUnits = state.LastUnitCount.HasValue
                ? (int)Math.Max(0, state.LastUnitCount.Value - state.SnapshotStartUnitCount)
                : 0;
            var goodUnits = state.LastGoodUnits.HasValue
                ? (int)Math.Max(0, Math.Min(totalUnits, state.LastGoodUnits.Value - state.SnapshotStartGoodUnits))
                : totalUnits; // no separate good-unit counter configured -> assume all counted units passed

            var actualRate = runMinutes > 0 ? Math.Round((decimal)totalUnits / runMinutes * 60m, 1) : 0m;

            // NOTE: use local/naive "now" (not UTC-labeled) for the reading's
            // own timestamp, matching the convention used by CSV import and
            // avoiding the display/timezone bug fixed earlier in this project.
            var recordedAt = DateTime.Now;
            var shiftName = ShiftCalendar.DetermineShiftName(recordedAt, shiftDefs ?? new List<ShiftDefinitionEntity>());

            var availability = plannedMinutes > 0 ? Math.Round((decimal)runMinutes / plannedMinutes * 100m, 2) : 0m;
            var performance = idealRate > 0 ? Math.Round(actualRate / idealRate * 100m, 2) : 0m;
            var quality = totalUnits > 0 ? Math.Round((decimal)goodUnits / totalUnits * 100m, 2) : 100m;
            var oee = Math.Round(availability / 100m * performance / 100m * quality / 100m * 100m, 2);

            var reading = new OeeReadingEntity
            {
                MachineId = machineId,
                RecordedAt = recordedAt,
                ShiftDate = DateOnly.FromDateTime(recordedAt),
                ShiftName = shiftName,
                Shift = "Live",
                PlannedTimeMinutes = plannedMinutes,
                RunTimeMinutes = runMinutes,
                IdealRate = idealRate,
                ActualRate = (int)Math.Round(actualRate),
                TotalUnits = totalUnits,
                GoodUnits = goodUnits,
                Availability = availability,
                Performance = performance,
                Quality = quality,
                OeeScore = oee,
                ProductId = productId,
                ChangeoverMinutes = changeoverMinutes
            };

            // Reset the window for the next snapshot.
            state.SnapshotStartUtc = nowUtc;
            state.AccumulatedRunSeconds = 0;
            if (state.LastUnitCount.HasValue) state.SnapshotStartUnitCount = state.LastUnitCount.Value;
            if (state.LastGoodUnits.HasValue) state.SnapshotStartGoodUnits = state.LastGoodUnits.Value;

            return reading;
        }
    }
}
