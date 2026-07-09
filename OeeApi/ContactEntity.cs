public class ContactEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Role { get; set; } = "Technician";
    public string? PhoneNumber { get; set; }
    public string? Department { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}