public class EightDReportEntity
{
    public int Id { get; set; }
    public int BreakdownId { get; set; }
    public string? D1_Team { get; set; }
    public string? D2_Problem { get; set; }
    public string? D3_ContainmentAction { get; set; }
    public string? D4_RootCause { get; set; }
    public string? D5_CorrectiveAction { get; set; }
    public string? D6_Implementation { get; set; }
    public string? D7_Prevention { get; set; }
    public string? D8_Closure { get; set; }
    public string Status { get; set; } = "Open";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}