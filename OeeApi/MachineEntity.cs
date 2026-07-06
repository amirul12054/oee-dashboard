public class MachineEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public bool IsRunning { get; set; }
    public int UnitsProduced { get; set; }
    public int GoodUnits { get; set; }
    public int PlannedTimeMinutes { get; set; }
    public int RunTimeMinutes { get; set; }
    public int IdealRate { get; set; }
    public int ActualRate { get; set; }
}