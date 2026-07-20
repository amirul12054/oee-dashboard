using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using SendGrid;
using SendGrid.Helpers.Mail;

var builder = WebApplication.CreateBuilder(args);
var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

builder.Services.AddDbContext<OeeDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddCors();
builder.Services.AddAntiforgery();
builder.Services.AddOpenApi();

var jwtKey = builder.Configuration["Jwt:Key"];
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!))
        };
    });

builder.Services.AddAuthorization(options =>
{
    // Full user/account management (create/delete users, change roles) - admin only
    options.AddPolicy("AdminOnly", p => p.RequireRole("admin"));
    // Managing machines and technician/engineer name cards (contacts) - engineer or admin
    options.AddPolicy("EngineerOrAdmin", p => p.RequireRole("engineer", "admin"));
});

var app = builder.Build();

app.UseCors(x => x.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseHttpsRedirection();

// ============ AUTH ============

app.MapPost("/auth/login", async (OeeDbContext db, LoginRequest req) =>
{
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == req.Username);
    if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        return Results.Unauthorized();

    var claims = new[]
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Name, user.Username),
        new Claim(ClaimTypes.Role, user.Role)
    };

    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!));
    var token = new JwtSecurityToken(
        issuer: builder.Configuration["Jwt:Issuer"],
        audience: builder.Configuration["Jwt:Audience"],
        claims: claims,
        expires: DateTime.UtcNow.AddHours(8),
        signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
    );

    return Results.Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token) });
});

app.MapPost("/auth/change-password", async (OeeDbContext db, ChangePasswordRequest req) =>
{
    var user = await db.Users.FindAsync(req.UserId);
    if (user == null) return Results.NotFound();
    if (!BCrypt.Net.BCrypt.Verify(req.OldPassword, user.PasswordHash))
        return Results.BadRequest("Current password is incorrect");
    user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
    await db.SaveChangesAsync();
    return Results.Ok("Password changed");
}).RequireAuthorization();

// ============ USERS ============

app.MapGet("/users", async (OeeDbContext db) =>
{
    var users = await db.Users
        .Select(u => new { u.Id, u.Username, u.Role, u.PhoneNumber, u.Department })
        .ToListAsync();
    return Results.Ok(users);
}).RequireAuthorization();

app.MapPut("/users/profile", async (OeeDbContext db, UpdateProfileRequest req) =>
{
    var user = await db.Users.FindAsync(req.UserId);
    if (user == null) return Results.NotFound();
    user.PhoneNumber = req.PhoneNumber;
    user.Department = req.Department;
    await db.SaveChangesAsync();
    return Results.Ok(new { user.Id, user.Username, user.PhoneNumber, user.Department, user.Role });
}).RequireAuthorization();

// ============ ADMIN - USERS ============

app.MapGet("/admin/users", async (OeeDbContext db) =>
{
    var users = await db.Users
        .Select(u => new { u.Id, u.Username, u.Role, u.PhoneNumber, u.Department })
        .ToListAsync();
    return Results.Ok(users);
}).RequireAuthorization("AdminOnly");

app.MapPost("/admin/users", async (OeeDbContext db, CreateUserRequest req) =>
{
    if (await db.Users.AnyAsync(u => u.Username == req.Username))
        return Results.BadRequest("Username already exists");

    var user = new UserEntity
    {
        Username = req.Username,
        Email = $"{req.Username}@oee.local",
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Username),
        Role = req.Role,
        PhoneNumber = req.PhoneNumber,
        Department = req.Department
    };

    db.Users.Add(user);
    await db.SaveChangesAsync();
    return Results.Ok(new { user.Id, user.Username, user.Role });
}).RequireAuthorization("AdminOnly");

app.MapPut("/admin/users/{id}/role", async (OeeDbContext db, int id, UpdateRoleRequest req) =>
{
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();
    user.Role = req.Role;
    await db.SaveChangesAsync();
    return Results.Ok(new { user.Id, user.Username, user.Role });
}).RequireAuthorization("AdminOnly");

app.MapPost("/admin/users/{id}/reset-password", async (OeeDbContext db, int id) =>
{
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();
    user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(user.Username);
    await db.SaveChangesAsync();
    return Results.Ok("Password reset to username");
}).RequireAuthorization("AdminOnly");

app.MapDelete("/admin/users/{id}", async (OeeDbContext db, int id) =>
{
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();
    db.Users.Remove(user);
    await db.SaveChangesAsync();
    return Results.Ok("User deleted");
}).RequireAuthorization("AdminOnly");

// ============ ADMIN - MACHINES ============

app.MapPost("/admin/machines", async (OeeDbContext db, MachineEntity machine) =>
{
    db.Machines.Add(machine);
    await db.SaveChangesAsync();
    return Results.Created($"/machines/{machine.Id}", machine);
}).RequireAuthorization("EngineerOrAdmin");

app.MapDelete("/admin/machines/{id}", async (OeeDbContext db, int id) =>
{
    var machine = await db.Machines.FindAsync(id);
    if (machine == null) return Results.NotFound();

    try
    {
        // Each layer is saved separately, in dependency order, before moving
        // to the next. EF Core has no navigation properties here to infer
        // the FK dependency graph, so a single combined SaveChanges can (and
        // did) send deletes to Postgres in the wrong order and get rejected
        // by the real foreign-key constraints.

        db.OeeReadings.RemoveRange(db.OeeReadings.Where(r => r.MachineId == id));
        await db.SaveChangesAsync();

        var breakdownIds = await db.Breakdowns.Where(b => b.MachineId == id)
            .Select(b => b.Id).ToListAsync();
        if (breakdownIds.Count > 0)
        {
            db.BreakdownAssignees.RemoveRange(db.BreakdownAssignees.Where(a => breakdownIds.Contains(a.BreakdownId)));
            db.EightDReports.RemoveRange(db.EightDReports.Where(r => breakdownIds.Contains(r.BreakdownId)));
            await db.SaveChangesAsync();
        }
        db.Breakdowns.RemoveRange(db.Breakdowns.Where(b => b.MachineId == id));
        await db.SaveChangesAsync();

        var pmScheduleIds = await db.PmSchedules.Where(p => p.MachineId == id)
            .Select(p => p.Id).ToListAsync();
        if (pmScheduleIds.Count > 0)
        {
            db.PmCompletions.RemoveRange(db.PmCompletions.Where(c => pmScheduleIds.Contains(c.PmScheduleId)));
            await db.SaveChangesAsync();
        }
        db.PmSchedules.RemoveRange(db.PmSchedules.Where(p => p.MachineId == id));
        await db.SaveChangesAsync();

        db.Machines.Remove(machine);
        await db.SaveChangesAsync();
        return Results.Ok("Machine deleted");
    }
    catch (Exception ex)
    {
        return Results.Problem($"Failed to delete machine: {ex.Message} | {ex.InnerException?.Message}");
    }
}).RequireAuthorization("EngineerOrAdmin");

// ============ MACHINES ============

app.MapGet("/machines", async (OeeDbContext db) =>
    await db.Machines.ToListAsync()).RequireAuthorization();

app.MapPost("/machines", async (OeeDbContext db, MachineEntity machine) =>
{
    db.Machines.Add(machine);
    await db.SaveChangesAsync();
    return Results.Created($"/machines/{machine.Id}", machine);
}).RequireAuthorization();

app.MapPut("/machines/{id}", async (OeeDbContext db, int id, MachineEntity updated) =>
{
    var machine = await db.Machines.FindAsync(id);
    if (machine == null) return Results.NotFound();
    machine.Name = updated.Name;
    machine.IsRunning = updated.IsRunning;
    machine.UnitsProduced = updated.UnitsProduced;
    machine.GoodUnits = updated.GoodUnits;
    machine.PlannedTimeMinutes = updated.PlannedTimeMinutes;
    machine.RunTimeMinutes = updated.RunTimeMinutes;
    machine.IdealRate = updated.IdealRate;
    machine.ActualRate = updated.ActualRate;
    await db.SaveChangesAsync();
    return Results.Ok(machine);
}).RequireAuthorization();

app.MapGet("/machines/{id}/history", async (OeeDbContext db, int id, string? from, string? to, string? shift) =>
{
    var query = db.OeeReadings.Where(r => r.MachineId == id);

    if (!string.IsNullOrEmpty(from) && DateOnly.TryParse(from, out var fromDate))
        query = query.Where(r => r.ShiftDate >= fromDate);

    if (!string.IsNullOrEmpty(to) && DateOnly.TryParse(to, out var toDate))
        query = query.Where(r => r.ShiftDate <= toDate);

    if (!string.IsNullOrEmpty(shift) && shift != "All")
        query = query.Where(r => r.ShiftName == shift);

    // No explicit range given -> keep old "recent 30" behavior.
    // Explicit range given -> return everything in range (capped at a sane max).
    var hasRange = !string.IsNullOrEmpty(from) || !string.IsNullOrEmpty(to);
    var history = hasRange
        ? await query.OrderByDescending(r => r.RecordedAt).Take(1000).ToListAsync()
        : await query.OrderByDescending(r => r.RecordedAt).Take(30).ToListAsync();

    return Results.Ok(history);
}).RequireAuthorization();

// ============ CSV IMPORT ============

app.MapPost("/import/preview", async (HttpRequest request, OeeDbContext db) =>
{
    var file = request.Form.Files.FirstOrDefault();
    if (file == null || file.Length == 0)
        return Results.BadRequest("No file uploaded");

    var lines = new List<string>();
    using var reader = new StreamReader(file.OpenReadStream());
    string? line;
    while (lines.Count < 6 && (line = await reader.ReadLineAsync()) != null)
        lines.Add(line);

    if (lines.Count == 0) return Results.BadRequest("Empty file");

    var headers = lines[0].Split(',').Select(h => h.Trim().Trim('"').Trim('\r')).ToList();
    var previewRows = lines.Skip(1).Select(l =>
        l.Split(',').Select(v => v.Trim().Trim('"').Trim('\r')).ToList()).ToList();
    var machines = await db.Machines.Select(m => new { m.Id, m.Name }).ToListAsync();

    return Results.Ok(new { headers, previewRows, machines });
}).RequireAuthorization().DisableAntiforgery();

app.MapPost("/import/process", async (HttpRequest request, OeeDbContext db) =>
{
    if (!request.HasFormContentType) return Results.BadRequest("Expected form data");

    var form = request.Form;
    var file = form.Files.FirstOrDefault();
    if (file == null) return Results.BadRequest("No file");

    int machineId = int.Parse(form["machineId"]!);
    string shift = form["shift"].ToString() ?? "Day";
    int colDate = int.Parse(form["colDate"]!);
    int colPlanned = int.Parse(form["colPlanned"]!);
    int colRunTime = int.Parse(form["colRunTime"]!);
    int colIdealRate = int.Parse(form["colIdealRate"]!);
    int colActualRate = int.Parse(form["colActualRate"]!);
    int colTotalUnits = int.Parse(form["colTotalUnits"]!);
    int colGoodUnits = int.Parse(form["colGoodUnits"]!);

    var readings = new List<OeeReadingEntity>();
    var skipped = 0;
    string? firstError = null;
    using var reader = new StreamReader(file.OpenReadStream());
    var isFirstLine = true;
    string? line;
    var rowNum = 1;

    while ((line = await reader.ReadLineAsync()) != null)
    {
        rowNum++;
        if (isFirstLine) { isFirstLine = false; continue; }
        if (string.IsNullOrWhiteSpace(line)) continue;

        var cols = line.Split(',').Select(v => v.Trim().Trim('"')).ToArray();
        try
        {
            var planned = (int)Math.Round(decimal.Parse(cols[colPlanned], CultureInfo.InvariantCulture));
            var runtime = (int)Math.Round(decimal.Parse(cols[colRunTime], CultureInfo.InvariantCulture));
            var idealRate = (int)Math.Round(decimal.Parse(cols[colIdealRate], CultureInfo.InvariantCulture));
            var actualRate = (int)Math.Round(decimal.Parse(cols[colActualRate], CultureInfo.InvariantCulture));
            var total = (int)Math.Round(decimal.Parse(cols[colTotalUnits], CultureInfo.InvariantCulture));
            var good = (int)Math.Round(decimal.Parse(cols[colGoodUnits], CultureInfo.InvariantCulture));

            var availability = planned > 0 ? (decimal)runtime / planned : 0;
            var performance = idealRate > 0 ? (decimal)actualRate / idealRate : 0;
            var quality = total > 0 ? (decimal)good / total : 0;
            var oee = availability * performance * quality * 100;

            var recordedAt = DateTime.TryParse(cols[colDate], out var dt)
    ? DateTime.SpecifyKind(dt, DateTimeKind.Utc)
    : DateTime.UtcNow;

            var shiftName = recordedAt.Hour >= 6 && recordedAt.Hour < 18
                ? "Morning" : "Night";

            readings.Add(new OeeReadingEntity
            {
                MachineId = machineId,
                RecordedAt = recordedAt,
                ShiftDate = DateOnly.FromDateTime(recordedAt),
                ShiftName = shiftName,
                Shift = shift,
                PlannedTimeMinutes = planned,
                RunTimeMinutes = runtime,
                IdealRate = idealRate,
                ActualRate = actualRate,
                TotalUnits = total,
                GoodUnits = good,
                Availability = Math.Round(availability * 100, 2),
                Performance = Math.Round(performance * 100, 2),
                Quality = Math.Round(quality * 100, 2),
                OeeScore = Math.Round(oee, 2)
            });
        }
        catch (Exception rowEx)
        {
            skipped++;
            firstError ??= $"Row {rowNum}: {rowEx.Message}";
            continue;
        }
    }

    try
    {
        db.OeeReadings.AddRange(readings);
        await db.SaveChangesAsync();
        return Results.Ok(new { imported = readings.Count, skipped, firstError });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message + " | " + ex.InnerException?.Message);
    }
}).RequireAuthorization().DisableAntiforgery();

// ============ BREAKDOWNS ============

app.MapGet("/breakdowns", async (OeeDbContext db) =>
    Results.Ok(await db.Breakdowns.OrderByDescending(b => b.CreatedAt).ToListAsync())
).RequireAuthorization();

app.MapPost("/breakdowns", async (OeeDbContext db, IConfiguration config, CreateBreakdownRequest req) =>
{
    var breakdown = new BreakdownEntity
    {
        MachineId = req.MachineId,
        ReportedByUserId = req.ReportedByUserId,
        AssignedToUserId = req.AssignedToUserId,
        Title = req.Title,
        Description = req.Description,
        BreakdownType = req.BreakdownType,
        Priority = req.Priority,
        StartTime = DateTime.UtcNow,
        Status = "Open",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    db.Breakdowns.Add(breakdown);
    await db.SaveChangesAsync();
    return Results.Created($"/breakdowns/{breakdown.Id}", breakdown);
}).RequireAuthorization();

app.MapPut("/breakdowns/{id}", async (OeeDbContext db, int id, UpdateBreakdownRequest req) =>
{
    var breakdown = await db.Breakdowns.FindAsync(id);
    if (breakdown == null) return Results.NotFound();

    breakdown.Status = req.Status;
    breakdown.RootCause = req.RootCause;
    breakdown.CorrectiveAction = req.CorrectiveAction;
    breakdown.AssignedToUserId = req.AssignedToUserId;
    breakdown.UpdatedAt = DateTime.UtcNow;

    if (req.Status == "Closed" && breakdown.EndTime == null)
    {
        var endTime = DateTime.UtcNow;
        var startTime = DateTime.SpecifyKind(breakdown.StartTime, DateTimeKind.Utc);
        breakdown.EndTime = endTime;
        var rawMinutes = (endTime - startTime).TotalMinutes;
        breakdown.DowntimeMinutes = rawMinutes < 1 ? 1 : (int)rawMinutes;

        if (breakdown.DowntimeMinutes > 60)
        {
            var machine = await db.Machines.FindAsync(breakdown.MachineId);
            db.EightDReports.Add(new EightDReportEntity
            {
                BreakdownId = breakdown.Id,
                D2_Problem = $"Machine: {machine?.Name} - {breakdown.Title}",
                Status = "Open",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }
    }

    await db.SaveChangesAsync();
    return Results.Ok(breakdown);
}).RequireAuthorization();

// ============ BREAKDOWN ASSIGNEES ============

app.MapGet("/breakdowns/{id}/assignees", async (OeeDbContext db, int id) =>
{
    var assignees = await db.BreakdownAssignees.Where(a => a.BreakdownId == id).ToListAsync();
    var result = new List<object>();
    foreach (var a in assignees)
    {
        var contact = await db.Contacts.FindAsync(a.UserId);
        if (contact != null)
            result.Add(new
            {
                a.Id,
                a.BreakdownId,
                a.UserId,
                a.Role,
                a.AssignedAt,
                contact.Name,
                contact.PhoneNumber,
                contact.Department
            });
    }
    return Results.Ok(result);
}).RequireAuthorization();

app.MapPost("/breakdowns/{id}/assignees", async (OeeDbContext db, int id, AddAssigneeRequest req) =>
{
    var breakdown = await db.Breakdowns.FindAsync(id);
    if (breakdown == null) return Results.NotFound();

    var existing = await db.BreakdownAssignees
        .FirstOrDefaultAsync(a => a.BreakdownId == id && a.UserId == req.UserId);
    if (existing != null) return Results.BadRequest("Already assigned");

    db.BreakdownAssignees.Add(new BreakdownAssigneeEntity
    {
        BreakdownId = id,
        UserId = req.UserId,
        Role = req.Role,
        AssignedAt = DateTime.UtcNow
    });
    await db.SaveChangesAsync();
    return Results.Ok("Assignee added");
}).RequireAuthorization();

app.MapDelete("/breakdowns/{id}/assignees/{contactId}", async (OeeDbContext db, int id, int contactId) =>
{
    var assignee = await db.BreakdownAssignees
        .FirstOrDefaultAsync(a => a.BreakdownId == id && a.UserId == contactId);
    if (assignee == null) return Results.NotFound();
    db.BreakdownAssignees.Remove(assignee);
    await db.SaveChangesAsync();
    return Results.Ok("Removed");
}).RequireAuthorization();

// ============ 8D REPORTS ============

app.MapGet("/8d-reports", async (OeeDbContext db) =>
    Results.Ok(await db.EightDReports.OrderByDescending(r => r.CreatedAt).ToListAsync())
).RequireAuthorization();

app.MapPut("/8d-reports/{id}", async (OeeDbContext db, int id, EightDReportEntity updated) =>
{
    var report = await db.EightDReports.FindAsync(id);
    if (report == null) return Results.NotFound();
    report.D1_Team = updated.D1_Team;
    report.D2_Problem = updated.D2_Problem;
    report.D3_ContainmentAction = updated.D3_ContainmentAction;
    report.D4_RootCause = updated.D4_RootCause;
    report.D5_CorrectiveAction = updated.D5_CorrectiveAction;
    report.D6_Implementation = updated.D6_Implementation;
    report.D7_Prevention = updated.D7_Prevention;
    report.D8_Closure = updated.D8_Closure;
    report.Status = updated.Status;
    report.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(report);
}).RequireAuthorization();

// ============ PM SCHEDULES ============

app.MapGet("/pm-schedules", async (OeeDbContext db) =>
    Results.Ok(await db.PmSchedules.OrderBy(p => p.NextDueAt).ToListAsync())
).RequireAuthorization();

app.MapPost("/pm-schedules", async (OeeDbContext db, PmScheduleEntity schedule) =>
{
    schedule.CreatedAt = DateTime.UtcNow;
    db.PmSchedules.Add(schedule);
    await db.SaveChangesAsync();
    return Results.Created($"/pm-schedules/{schedule.Id}", schedule);
}).RequireAuthorization();

app.MapPost("/pm-schedules/{id}/complete", async (OeeDbContext db, int id, CompletePmRequest req) =>
{
    var schedule = await db.PmSchedules.FindAsync(id);
    if (schedule == null) return Results.NotFound();
    var nextDue = DateTime.UtcNow.AddDays(schedule.FrequencyDays);
    db.PmCompletions.Add(new PmCompletionEntity
    {
        PmScheduleId = id,
        CompletedByUserId = req.CompletedByUserId,
        CompletedAt = DateTime.UtcNow,
        Notes = req.Notes,
        NextDueAt = nextDue
    });
    schedule.LastDoneAt = DateTime.UtcNow;
    schedule.NextDueAt = nextDue;
    await db.SaveChangesAsync();
    return Results.Ok(schedule);
}).RequireAuthorization();

// ============ MAINTENANCE SUMMARY ============

app.MapGet("/maintenance/summary", async (OeeDbContext db) =>
{
    var closedBreakdowns = await db.Breakdowns
        .Where(b => b.Status == "Closed" && b.DowntimeMinutes.HasValue).ToListAsync();
    var totalBreakdowns = await db.Breakdowns.CountAsync();
    var openBreakdowns = await db.Breakdowns.CountAsync(b => b.Status == "Open");
    var avgMttr = closedBreakdowns.Any() ? closedBreakdowns.Average(b => b.DowntimeMinutes!.Value) : 0;
    var overduepm = await db.PmSchedules.CountAsync(p => p.NextDueAt < DateTime.UtcNow);
    return Results.Ok(new
    {
        totalBreakdowns,
        openBreakdowns,
        avgMttr = Math.Round(avgMttr, 1),
        overduepm,
        closedBreakdowns = closedBreakdowns.Count
    });
}).RequireAuthorization();

// ============ PDCA ============

app.MapGet("/pdca", async (OeeDbContext db) =>
    Results.Ok(await db.Pdca.OrderByDescending(p => p.CreatedAt).ToListAsync())
).RequireAuthorization();

app.MapPost("/pdca", async (OeeDbContext db, PdcaEntity pdca) =>
{
    pdca.CreatedAt = DateTime.UtcNow;
    pdca.UpdatedAt = DateTime.UtcNow;
    db.Pdca.Add(pdca);
    await db.SaveChangesAsync();
    return Results.Created($"/pdca/{pdca.Id}", pdca);
}).RequireAuthorization();

app.MapPut("/pdca/{id}", async (OeeDbContext db, int id, PdcaEntity updated) =>
{
    var pdca = await db.Pdca.FindAsync(id);
    if (pdca == null) return Results.NotFound();
    pdca.Plan = updated.Plan;
    pdca.DoAction = updated.DoAction;
    pdca.Check = updated.Check;
    pdca.Act = updated.Act;
    pdca.Status = updated.Status;
    pdca.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(pdca);
}).RequireAuthorization();

// ============ CONTACTS ============

app.MapGet("/contacts", async (OeeDbContext db) =>
    Results.Ok(await db.Contacts.OrderBy(c => c.Name).ToListAsync())
).RequireAuthorization();

app.MapPost("/contacts", async (OeeDbContext db, ContactEntity contact) =>
{
    contact.CreatedAt = DateTime.UtcNow;
    db.Contacts.Add(contact);
    await db.SaveChangesAsync();
    return Results.Created($"/contacts/{contact.Id}", contact);
}).RequireAuthorization("EngineerOrAdmin");

app.MapPut("/contacts/{id}", async (OeeDbContext db, int id, ContactEntity updated) =>
{
    var contact = await db.Contacts.FindAsync(id);
    if (contact == null) return Results.NotFound();
    contact.Name = updated.Name;
    contact.Role = updated.Role;
    contact.PhoneNumber = updated.PhoneNumber;
    contact.Department = updated.Department;
    await db.SaveChangesAsync();
    return Results.Ok(contact);
}).RequireAuthorization("EngineerOrAdmin");

app.MapDelete("/contacts/{id}", async (OeeDbContext db, int id) =>
{
    var contact = await db.Contacts.FindAsync(id);
    if (contact == null) return Results.NotFound();
    db.Contacts.Remove(contact);
    await db.SaveChangesAsync();
    return Results.Ok("Deleted");
}).RequireAuthorization("EngineerOrAdmin");

app.MapGet("/setup-contacts", async (OeeDbContext db) =>
{
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""Contacts"" (
            ""Id"" SERIAL PRIMARY KEY,
            ""Name"" VARCHAR(100) NOT NULL,
            ""Role"" VARCHAR(50) NOT NULL DEFAULT 'Technician',
            ""PhoneNumber"" VARCHAR(20),
            ""Department"" VARCHAR(100),
            ""CreatedAt"" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS ""BreakdownAssignees"" (
            ""Id"" SERIAL PRIMARY KEY,
            ""BreakdownId"" INTEGER NOT NULL REFERENCES ""Breakdowns""(""Id""),
            ""UserId"" INTEGER NOT NULL,
            ""Role"" VARCHAR(50) NOT NULL DEFAULT 'Technician',
            ""AssignedAt"" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
    ");
    return Results.Ok("Contacts and assignees tables ready");
});
app.MapGet("/setup-machine-connections", async (OeeDbContext db) =>
{
    await db.Database.ExecuteSqlRawAsync(@"
        ALTER TABLE ""Machines"" 
        ADD COLUMN IF NOT EXISTS ""ConnectionType"" VARCHAR(50) DEFAULT 'CSV',
        ADD COLUMN IF NOT EXISTS ""OpcUaEndpoint"" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS ""OpcUaNamespace"" INTEGER DEFAULT 2,
        ADD COLUMN IF NOT EXISTS ""OpcUaNodeRunStatus"" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS ""OpcUaNodeUnitCount"" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS ""OpcUaNodeGoodUnits"" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS ""OpcUaNodeFaultStatus"" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS ""ModbusIp"" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS ""ModbusPort"" INTEGER DEFAULT 502,
        ADD COLUMN IF NOT EXISTS ""ModbusSlaveId"" INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS ""ModbusRegRunStatus"" INTEGER,
        ADD COLUMN IF NOT EXISTS ""ModbusRegUnitCount"" INTEGER,
        ADD COLUMN IF NOT EXISTS ""ModbusRegGoodUnits"" INTEGER,
        ADD COLUMN IF NOT EXISTS ""ModbusRegFaultStatus"" INTEGER,
        ADD COLUMN IF NOT EXISTS ""CsvFilePath"" VARCHAR(500),
        ADD COLUMN IF NOT EXISTS ""CsvAutoImport"" BOOLEAN DEFAULT FALSE;
    ");
    return Results.Ok("Machine connection columns added");
});

// PUT update machine with connection settings
app.MapPut("/admin/machines/{id}", async (OeeDbContext db, int id, MachineEntity updated) =>
{
    var machine = await db.Machines.FindAsync(id);
    if (machine == null) return Results.NotFound();
    machine.Name = updated.Name;
    machine.IsRunning = updated.IsRunning;
    machine.IdealRate = updated.IdealRate;
    machine.PlannedTimeMinutes = updated.PlannedTimeMinutes;
    machine.ConnectionType = updated.ConnectionType;
    machine.OpcUaEndpoint = updated.OpcUaEndpoint;
    machine.OpcUaNamespace = updated.OpcUaNamespace;
    machine.OpcUaNodeRunStatus = updated.OpcUaNodeRunStatus;
    machine.OpcUaNodeUnitCount = updated.OpcUaNodeUnitCount;
    machine.OpcUaNodeGoodUnits = updated.OpcUaNodeGoodUnits;
    machine.OpcUaNodeFaultStatus = updated.OpcUaNodeFaultStatus;
    machine.ModbusIp = updated.ModbusIp;
    machine.ModbusPort = updated.ModbusPort;
    machine.ModbusSlaveId = updated.ModbusSlaveId;
    machine.ModbusRegRunStatus = updated.ModbusRegRunStatus;
    machine.ModbusRegUnitCount = updated.ModbusRegUnitCount;
    machine.ModbusRegGoodUnits = updated.ModbusRegGoodUnits;
    machine.ModbusRegFaultStatus = updated.ModbusRegFaultStatus;
    machine.CsvFilePath = updated.CsvFilePath;
    machine.CsvAutoImport = updated.CsvAutoImport;
    await db.SaveChangesAsync();
    return Results.Ok(machine);
}).RequireAuthorization("EngineerOrAdmin");

app.MapGet("/setup-shifts", async (OeeDbContext db) =>
{
    await db.Database.ExecuteSqlRawAsync(@"
        ALTER TABLE ""OeeReadings"" 
        ADD COLUMN IF NOT EXISTS ""ShiftDate"" DATE,
        ADD COLUMN IF NOT EXISTS ""ShiftName"" VARCHAR(20) DEFAULT 'Morning';
        
        UPDATE ""OeeReadings"" 
        SET ""ShiftDate"" = DATE(""RecordedAt""),
            ""ShiftName"" = CASE 
                WHEN EXTRACT(HOUR FROM ""RecordedAt"") >= 6 
                AND EXTRACT(HOUR FROM ""RecordedAt"") < 18 
                THEN 'Morning' 
                ELSE 'Night' 
            END
        WHERE ""ShiftDate"" IS NULL;
    ");
    return Results.Ok("Shift columns added");
});

// GET OEE readings filtered by date and shift
app.MapGet("/oee-readings", async (OeeDbContext db,
    string? date, string? shift, int? machineId) =>
{
    var query = db.OeeReadings.AsQueryable();

    if (!string.IsNullOrEmpty(date) && DateOnly.TryParse(date, out var d))
        query = query.Where(r => r.ShiftDate == d);

    if (!string.IsNullOrEmpty(shift) && shift != "All")
        query = query.Where(r => r.ShiftName == shift);

    if (machineId.HasValue)
        query = query.Where(r => r.MachineId == machineId.Value);

    var results = await query
        .OrderByDescending(r => r.RecordedAt)
        .Take(100)
        .ToListAsync();

    return Results.Ok(results);
}).RequireAuthorization();

app.MapGet("/debug-readings", async (OeeDbContext db) =>
{
    var readings = await db.OeeReadings
        .OrderByDescending(r => r.RecordedAt)
        .Take(10)
        .Select(r => new
        {
            r.Id,
            r.MachineId,
            r.RecordedAt,
            r.ShiftDate,
            r.ShiftName,
            r.OeeScore,
            r.TotalUnits
        })
        .ToListAsync();
    return Results.Ok(readings);
});

app.Run();

// ============ RECORDS ============
record LoginRequest(string Username, string Password);
record ChangePasswordRequest(int UserId, string OldPassword, string NewPassword);
record CreateUserRequest(string Username, string Role, string? PhoneNumber, string? Department);
record UpdateRoleRequest(string Role);
record UpdateProfileRequest(int UserId, string? PhoneNumber, string? Department);
record CreateBreakdownRequest(int MachineId, int ReportedByUserId, int? AssignedToUserId, string Title, string? Description, string BreakdownType, string Priority);
record UpdateBreakdownRequest(string Status, string? RootCause, string? CorrectiveAction, int? AssignedToUserId);
record CompletePmRequest(int CompletedByUserId, string? Notes);
record AddAssigneeRequest(int UserId, string Role);