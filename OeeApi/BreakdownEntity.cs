public class BreakdownEntity
{
    public int Id { get; set; }
    public int MachineId { get; set; }
    public int ReportedByUserId { get; set; }
    public int? AssignedToUserId { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string BreakdownType { get; set; } = "Unplanned";
    public string Status { get; set; } = "Open";
    public string Priority { get; set; } = "Medium";
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? DowntimeMinutes { get; set; }
    public string? RootCause { get; set; }
    public string? CorrectiveAction { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}