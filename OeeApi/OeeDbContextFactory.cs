using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

public class OeeDbContextFactory : IDesignTimeDbContextFactory<OeeDbContext>
{
    public OeeDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<OeeDbContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Port=5432;Database=oeedb;Username=postgres;Password=Amirul1@");

        return new OeeDbContext(optionsBuilder.Options);
    }
}