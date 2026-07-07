public class PmScheduleEntity
{
    public int Id { get; set; }
    public int MachineId { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string Type { get; set; } = "PM";
    public int FrequencyDays { get; set; } = 30;
    public DateTime? LastDoneAt { get; set; }
    public DateTime NextDueAt { get; set; }
    public int? AssignedToUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}