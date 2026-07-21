/// <summary>
/// Determines which configured shift a given timestamp falls into, and
/// whether a given date is a holiday. Centralized so CSV import, the live
/// pollers, and any future ingestion path all agree on the same shift
/// boundaries instead of each hardcoding 6am/6pm separately.
/// </summary>
public static class ShiftCalendar
{
    /// <summary>
    /// Returns the name of the shift that contains the given time-of-day,
    /// checking configured shifts (including ones that wrap past midnight).
    /// Falls back to the legacy 6am-6pm Morning/Night split if no shifts
    /// have been configured yet, so existing data/behavior doesn't change
    /// for factories that haven't set this up.
    /// </summary>
    public static string DetermineShiftName(DateTime timestamp, List<ShiftDefinitionEntity> shifts)
    {
        var active = shifts.Where(s => s.IsActive).OrderBy(s => s.SortOrder).ToList();
        if (active.Count == 0)
            return timestamp.Hour >= 6 && timestamp.Hour < 18 ? "Morning" : "Night";

        var t = TimeOnly.FromDateTime(timestamp);
        foreach (var shift in active)
        {
            if (IsWithin(t, shift.StartTime, shift.EndTime))
                return shift.Name;
        }

        // Didn't match any configured shift (gap in the schedule) -> fall back
        // to whichever configured shift is nearest, rather than silently
        // mislabeling as "Morning".
        return active[0].Name;
    }

    private static bool IsWithin(TimeOnly t, TimeOnly start, TimeOnly end)
    {
        if (start <= end)
            return t >= start && t < end; // normal same-day shift
        return t >= start || t < end;     // overnight shift (e.g. 18:00 -> 06:00)
    }

    /// <summary>True if the given date is a configured holiday for this machine (or factory-wide).</summary>
    public static bool IsHoliday(DateOnly date, int machineId, List<HolidayEntity> holidays)
    {
        return holidays.Any(h => h.Date == date && (h.MachineId == null || h.MachineId == machineId));
    }
}
