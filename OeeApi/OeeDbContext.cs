using Microsoft.EntityFrameworkCore;

public class OeeDbContext : DbContext
{
    public OeeDbContext(DbContextOptions<OeeDbContext> options) : base(options) { }

    public DbSet<MachineEntity> Machines { get; set; }
    public DbSet<UserEntity> Users { get; set; }
    public DbSet<VerificationCodeEntity> VerificationCodes { get; set; }
    public DbSet<OeeReadingEntity> OeeReadings { get; set; }
}