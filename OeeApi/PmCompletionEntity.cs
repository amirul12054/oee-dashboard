public class PmCompletionEntity
{
    public int Id { get; set; }
    public int PmScheduleId { get; set; }
    public int CompletedByUserId { get; set; }
    public DateTime CompletedAt { get; set; }
    public string? Notes { get; set; }
    public DateTime NextDueAt { get; set; }
}