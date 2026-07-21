/// <summary>
/// A configurable shift pattern (e.g. Morning 06:00-18:00, or a 3-shift
/// 07:00-15:00/15:00-23:00/23:00-07:00 pattern). Replaces the previously
/// hardcoded 6am-6pm split. StartTime/EndTime support overnight wraparound
/// (e.g. Night 18:00 -> 06:00 next day).
/// </summary>
public class ShiftDefinitionEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = ""; // e.g. "Morning", "Afternoon", "Night"
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; } = 0;
}
