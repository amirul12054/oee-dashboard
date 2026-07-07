public class PdcaEntity
{
    public int Id { get; set; }
    public int MachineId { get; set; }
    public string Title { get; set; } = "";
    public string? Plan { get; set; }
    public string? DoAction { get; set; }
    public string? Check { get; set; }
    public string? Act { get; set; }
    public string Status { get; set; } = "Plan";
    public int? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}