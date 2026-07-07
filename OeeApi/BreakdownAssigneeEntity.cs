public class BreakdownAssigneeEntity
{
    public int Id { get; set; }
    public int BreakdownId { get; set; }
    public int UserId { get; set; }
    public string Role { get; set; } = "Technician";
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
}