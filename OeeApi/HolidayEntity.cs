/// <summary>
/// A specific date the factory (or a line) is scheduled to be off — public
/// holiday, planned shutdown, etc. Used so machines correctly show
/// "Holiday" instead of "Down"/"No Data" on days they weren't meant to run.
/// </summary>
public class HolidayEntity
{
    public int Id { get; set; }
    public DateOnly Date { get; set; }
    public string Reason { get; set; } = "";
    // Null = applies factory-wide. Set = applies only to this machine.
    public int? MachineId { get; set; }
}
