public class OeeReadingEntity
{
    public int Id { get; set; }
    public int MachineId { get; set; }
    public DateTime RecordedAt { get; set; }
    public string Shift { get; set; } = "Day";
    public int PlannedTimeMinutes { get; set; }
    public int RunTimeMinutes { get; set; }
    public int IdealRate { get; set; }
    public int ActualRate { get; set; }
    public int TotalUnits { get; set; }
    public int GoodUnits { get; set; }
    public decimal Availability { get; set; }
    public decimal Performance { get; set; }
    public decimal Quality { get; set; }
    public decimal OeeScore { get; set; }
}