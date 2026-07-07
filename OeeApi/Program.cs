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

// JWT Authentication setup
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

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseCors(x => x
    .WithOrigins(
        "http://localhost:3000",
        "https://oee-dashboard-lime.vercel.app"
    )
    .AllowAnyMethod()
    .AllowAnyHeader()
    .AllowCredentials());
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseHttpsRedirection();

// REGISTER a new user
app.MapPost("/auth/register", async (OeeDbContext db, RegisterRequest req) =>
{
    if (await db.Users.AnyAsync(u => u.Email == req.Email))
        return Results.BadRequest("Email already exists");

    var user = new UserEntity
    {
        Email = req.Email,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
        Role = "operator"
    };

    db.Users.Add(user);
    await db.SaveChangesAsync();
    return Results.Ok("User created");
});

// LOGIN
app.MapPost("/auth/login", async (OeeDbContext db, LoginRequest req) =>
{
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
    if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        return Results.Unauthorized();

    var claims = new[]
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Email, user.Email),
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

// GET machines - protected
app.MapGet("/machines", async (OeeDbContext db) =>
    await db.Machines.ToListAsync()).RequireAuthorization();

// POST machine - protected
app.MapPost("/machines", async (OeeDbContext db, MachineEntity machine) =>
{
    db.Machines.Add(machine);
    await db.SaveChangesAsync();
    return Results.Created($"/machines/{machine.Id}", machine);
}).RequireAuthorization();

// PUT machine - protected
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

// SEND verification code (for registration or forgot password)
app.MapPost("/auth/send-code", async (OeeDbContext db, IConfiguration config, SendCodeRequest req) =>
{
    // Generate 6-digit code
    var code = new Random().Next(100000, 999999).ToString();
    var expiry = DateTime.UtcNow.AddMinutes(15);

    // Save code to database
    db.VerificationCodes.Add(new VerificationCodeEntity
    {
        Email = req.Email,
        Code = code,
        Type = req.Type,
        ExpiresAt = expiry,
        IsUsed = false
    });
    await db.SaveChangesAsync();

    // Send email via SendGrid
    var apiKey = config["SendGrid:ApiKey"];
    var client = new SendGridClient(apiKey);
    var from = new EmailAddress(config["SendGrid:FromEmail"], config["SendGrid:FromName"]);
    var to = new EmailAddress(req.Email);
    var subject = req.Type == "register" ? "Verify your OEE Dashboard account" : "Reset your password";
    var body = $"Your verification code is: <strong>{code}</strong><br/>This code expires in 15 minutes.";
    var msg = MailHelper.CreateSingleEmail(from, to, subject, code, body);
    var response = await client.SendEmailAsync(msg);

    if (!response.IsSuccessStatusCode)
        return Results.Problem("Failed to send email");

    return Results.Ok("Code sent");
});

// VERIFY code + complete registration
app.MapPost("/auth/verify-register", async (OeeDbContext db, VerifyRegisterRequest req) =>
{
    var record = await db.VerificationCodes
        .Where(v => v.Email == req.Email && v.Code == req.Code
               && v.Type == "register" && !v.IsUsed && v.ExpiresAt > DateTime.UtcNow)
        .FirstOrDefaultAsync();

    if (record == null)
        return Results.BadRequest("Invalid or expired code");

    // Check email not already registered
    if (await db.Users.AnyAsync(u => u.Email == req.Email))
        return Results.BadRequest("Email already registered");

    // Create user
    db.Users.Add(new UserEntity
    {
        Email = req.Email,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
        Role = "operator"
    });

    record.IsUsed = true;
    await db.SaveChangesAsync();
    return Results.Ok("Account created successfully");
});

// SEND forgot password code
app.MapPost("/auth/forgot-password", async (OeeDbContext db, IConfiguration config, ForgotPasswordRequest req) =>
{
    // Always return OK even if email doesn't exist (security best practice)
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
    if (user == null) return Results.Ok("If that email exists, a code has been sent");

    var code = new Random().Next(100000, 999999).ToString();
    db.VerificationCodes.Add(new VerificationCodeEntity
    {
        Email = req.Email,
        Code = code,
        Type = "reset",
        ExpiresAt = DateTime.UtcNow.AddMinutes(15),
        IsUsed = false
    });
    await db.SaveChangesAsync();

    var apiKey = config["SendGrid:ApiKey"];
    var client = new SendGridClient(apiKey);
    var from = new EmailAddress(config["SendGrid:FromEmail"], config["SendGrid:FromName"]);
    var to = new EmailAddress(req.Email);
    var msg = MailHelper.CreateSingleEmail(from, to,
        "Reset your OEE Dashboard password",
        $"Your password reset code is: {code}. Expires in 15 minutes.",
        $"Your password reset code is: <strong>{code}</strong><br/>Expires in 15 minutes.");
    await client.SendEmailAsync(msg);

    return Results.Ok("If that email exists, a code has been sent");
});

// RESET password with code
app.MapPost("/auth/reset-password", async (OeeDbContext db, ResetPasswordRequest req) =>
{
    var record = await db.VerificationCodes
        .Where(v => v.Email == req.Email && v.Code == req.Code
               && v.Type == "reset" && !v.IsUsed && v.ExpiresAt > DateTime.UtcNow)
        .FirstOrDefaultAsync();

    if (record == null)
        return Results.BadRequest("Invalid or expired code");

    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
    if (user == null) return Results.BadRequest("User not found");

    user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
    record.IsUsed = true;
    await db.SaveChangesAsync();

    return Results.Ok("Password reset successfully");
});

// POST - upload CSV and return headers + preview rows
app.MapPost("/import/preview", async (HttpRequest request, OeeDbContext db) =>
{
    var file = request.Form.Files.FirstOrDefault();
    if (file == null || file.Length == 0)
        return Results.BadRequest("No file uploaded");

    var lines = new List<string>();
    using var reader = new StreamReader(file.OpenReadStream());
    while (!reader.EndOfStream && lines.Count < 6)
    {
        var line = await reader.ReadLineAsync();
        if (line != null) lines.Add(line);
    }

    if (lines.Count == 0)
        return Results.BadRequest("Empty file");

    var headers = lines[0].Split(',')
        .Select(h => h.Trim().Trim('"').Trim('\r')).ToList();

    var previewRows = lines.Skip(1).Select(line =>
        line.Split(',').Select(v => v.Trim().Trim('"').Trim('\r')).ToList()
    ).ToList();

    var machines = await db.Machines
        .Select(m => new { m.Id, m.Name }).ToListAsync();

    return Results.Ok(new { headers, previewRows, machines });
}).RequireAuthorization()
.DisableAntiforgery();

// POST - process CSV with column mapping
app.MapPost("/import/process", async (HttpRequest request, OeeDbContext db) =>
{
    if (!request.HasFormContentType)
        return Results.BadRequest("Expected form data");

    var form = request.Form;
    var file = form.Files.FirstOrDefault();
    if (file == null) return Results.BadRequest("No file");

    // Read column mapping from form
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
    using var reader = new StreamReader(file.OpenReadStream());
    var isFirstLine = true;

    while (!reader.EndOfStream)
    {
        var line = await reader.ReadLineAsync() ?? "";
        if (isFirstLine) { isFirstLine = false; continue; }
        if (string.IsNullOrWhiteSpace(line)) continue;

        var cols = line.Split(',').Select(v => v.Trim().Trim('"')).ToArray();

        try
        {
            var planned = int.Parse(cols[colPlanned]);
            var runtime = int.Parse(cols[colRunTime]);
            var idealRate = int.Parse(cols[colIdealRate]);
            var actualRate = int.Parse(cols[colActualRate]);
            var total = int.Parse(cols[colTotalUnits]);
            var good = int.Parse(cols[colGoodUnits]);

            var availability = planned > 0 ? (decimal)runtime / planned : 0;
            var performance = idealRate > 0 ? (decimal)actualRate / idealRate : 0;
            var quality = total > 0 ? (decimal)good / total : 0;
            var oee = availability * performance * quality * 100;

            readings.Add(new OeeReadingEntity
            {
                MachineId = machineId,
                RecordedAt = DateTime.TryParse(cols[colDate], out var dt)
               ? DateTime.SpecifyKind(dt, DateTimeKind.Utc)
               : DateTime.UtcNow,
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
        catch { continue; }
    }

    try
    {
        db.OeeReadings.AddRange(readings);
        await db.SaveChangesAsync();
        return Results.Ok(new { imported = readings.Count });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message + " | " + ex.InnerException?.Message);
    }
}).RequireAuthorization()
.DisableAntiforgery();

// GET - OEE history for a machine
app.MapGet("/machines/{id}/history", async (OeeDbContext db, int id) =>
{
    var history = await db.OeeReadings
        .Where(r => r.MachineId == id)
        .OrderByDescending(r => r.RecordedAt)
        .Take(30)
        .ToListAsync();
    return Results.Ok(history);
}).RequireAuthorization();


// GET all users - admin only
app.MapGet("/admin/users", async (OeeDbContext db) =>
{
    var users = await db.Users
        .Select(u => new { u.Id, u.Email, u.Role })
        .ToListAsync();
    return Results.Ok(users);
}).RequireAuthorization();

// PUT update user role - admin only
app.MapPut("/admin/users/{id}/role", async (OeeDbContext db, int id, UpdateRoleRequest req) =>
{
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();
    user.Role = req.Role;
    await db.SaveChangesAsync();
    return Results.Ok(new { user.Id, user.Email, user.Role });
}).RequireAuthorization();

// DELETE user - admin only
app.MapDelete("/admin/users/{id}", async (OeeDbContext db, int id) =>
{
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();
    db.Users.Remove(user);
    await db.SaveChangesAsync();
    return Results.Ok("User deleted");
}).RequireAuthorization();

// POST add new machine - admin only
app.MapPost("/admin/machines", async (OeeDbContext db, MachineEntity machine) =>
{
    db.Machines.Add(machine);
    await db.SaveChangesAsync();
    return Results.Created($"/machines/{machine.Id}", machine);
}).RequireAuthorization();

// DELETE machine - admin only
app.MapDelete("/admin/machines/{id}", async (OeeDbContext db, int id) =>
{
    var machine = await db.Machines.FindAsync(id);
    if (machine == null) return Results.NotFound();
    db.Machines.Remove(machine);
    await db.SaveChangesAsync();
    return Results.Ok("Machine deleted");
}).RequireAuthorization();

app.MapPost("/auth/make-admin", async (OeeDbContext db, IConfiguration config, MakeAdminRequest req) =>
{
    var setupSecret = config["Admin:SetupSecret"];
    if (string.IsNullOrEmpty(setupSecret) || req.Secret != setupSecret) return Results.Unauthorized();
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
    if (user == null) return Results.NotFound();
    user.Role = "admin";
    await db.SaveChangesAsync();
    return Results.Ok("Role updated to admin");
});

// GET all breakdowns
app.MapGet("/breakdowns", async (OeeDbContext db) =>
{
    var breakdowns = await db.Breakdowns
        .OrderByDescending(b => b.CreatedAt)
        .ToListAsync();
    return Results.Ok(breakdowns);
}).RequireAuthorization();

// GET breakdown by id
app.MapGet("/breakdowns/{id}", async (OeeDbContext db, int id) =>
{
    var breakdown = await db.Breakdowns.FindAsync(id);
    if (breakdown == null) return Results.NotFound();
    return Results.Ok(breakdown);
}).RequireAuthorization();

// POST create breakdown
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

    // Send email alert if assigned to someone
    if (req.AssignedToUserId.HasValue)
    {
        var assignedUser = await db.Users.FindAsync(req.AssignedToUserId.Value);
        var machine = await db.Machines.FindAsync(req.MachineId);
        if (assignedUser != null && machine != null)
        {
            try
            {
                var apiKey = config["SendGrid:ApiKey"];
                var client = new SendGridClient(apiKey);
                var from = new EmailAddress(config["SendGrid:FromEmail"], config["SendGrid:FromName"]);
                var to = new EmailAddress(assignedUser.Email);
                var subject = $"[BREAKDOWN ALERT] {machine.Name} - {req.Priority} Priority";
                var body = $@"
                    <h2>Breakdown Alert</h2>
                    <p><strong>Machine:</strong> {machine.Name}</p>
                    <p><strong>Title:</strong> {req.Title}</p>
                    <p><strong>Description:</strong> {req.Description}</p>
                    <p><strong>Priority:</strong> {req.Priority}</p>
                    <p><strong>Type:</strong> {req.BreakdownType}</p>
                    <p><strong>Time:</strong> {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC</p>
                    <p>Please attend to this breakdown immediately.</p>
                ";
                var msg = MailHelper.CreateSingleEmail(from, to, subject, req.Title, body);
                await client.SendEmailAsync(msg);
            }
            catch { /* Don't fail if email fails */ }
        }
    }

    return Results.Created($"/breakdowns/{breakdown.Id}", breakdown);
}).RequireAuthorization();

// PUT close/update breakdown
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

        // Auto-create 8D report if downtime > 60 minutes
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

// GET 8D reports
app.MapGet("/8d-reports", async (OeeDbContext db) =>
{
    var reports = await db.EightDReports
        .OrderByDescending(r => r.CreatedAt)
        .ToListAsync();
    return Results.Ok(reports);
}).RequireAuthorization();

// PUT update 8D report
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

// GET PM schedules
app.MapGet("/pm-schedules", async (OeeDbContext db) =>
{
    var schedules = await db.PmSchedules
        .OrderBy(p => p.NextDueAt)
        .ToListAsync();
    return Results.Ok(schedules);
}).RequireAuthorization();

// POST create PM schedule
app.MapPost("/pm-schedules", async (OeeDbContext db, PmScheduleEntity schedule) =>
{
    schedule.CreatedAt = DateTime.UtcNow;
    db.PmSchedules.Add(schedule);
    await db.SaveChangesAsync();
    return Results.Created($"/pm-schedules/{schedule.Id}", schedule);
}).RequireAuthorization();

// POST complete PM
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

// GET maintenance summary (MTBF, MTTR)
app.MapGet("/maintenance/summary", async (OeeDbContext db) =>
{
    var closedBreakdowns = await db.Breakdowns
        .Where(b => b.Status == "Closed" && b.DowntimeMinutes.HasValue)
        .ToListAsync();

    var totalBreakdowns = await db.Breakdowns.CountAsync();
    var openBreakdowns = await db.Breakdowns.CountAsync(b => b.Status == "Open");
    var avgMttr = closedBreakdowns.Any()
        ? closedBreakdowns.Average(b => b.DowntimeMinutes!.Value)
        : 0;

    var overduepm = await db.PmSchedules
        .CountAsync(p => p.NextDueAt < DateTime.UtcNow);

    return Results.Ok(new
    {
        totalBreakdowns,
        openBreakdowns,
        avgMttr = Math.Round(avgMttr, 1),
        overduepm,
        closedBreakdowns = closedBreakdowns.Count
    });
}).RequireAuthorization();

// Update user role directly - temporary
app.MapPost("/auth/set-role", async (OeeDbContext db, SetRoleRequest req) =>
{
    if (req.Secret != "OeeSetup2026") return Results.Unauthorized();
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
    if (user == null) return Results.NotFound();
    user.Role = req.Role;
    await db.SaveChangesAsync();
    return Results.Ok($"Role updated to {req.Role}");
});
// GET all PDCA
app.MapGet("/pdca", async (OeeDbContext db) =>
    await db.Pdca.OrderByDescending(p => p.CreatedAt).ToListAsync()
).RequireAuthorization();

// POST create PDCA
app.MapPost("/pdca", async (OeeDbContext db, PdcaEntity pdca) =>
{
    pdca.CreatedAt = DateTime.UtcNow;
    pdca.UpdatedAt = DateTime.UtcNow;
    db.Pdca.Add(pdca);
    await db.SaveChangesAsync();
    return Results.Created($"/pdca/{pdca.Id}", pdca);
}).RequireAuthorization();

// PUT update PDCA
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

app.MapGet("/setup-pdca", async (OeeDbContext db) =>
{
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""Pdca"" (
            ""Id"" SERIAL PRIMARY KEY,
            ""MachineId"" INTEGER NOT NULL REFERENCES ""Machines""(""Id""),
            ""Title"" VARCHAR(255) NOT NULL,
            ""Plan"" TEXT,
            ""DoAction"" TEXT,
            ""Check"" TEXT,
            ""Act"" TEXT,
            ""Status"" VARCHAR(50) NOT NULL DEFAULT 'Plan',
            ""CreatedByUserId"" INTEGER REFERENCES ""Users""(""Id""),
            ""CreatedAt"" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            ""UpdatedAt"" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
    ");
    return Results.Ok("PDCA table created");
});
app.MapGet("/setup-phone", async (OeeDbContext db) =>
{
    await db.Database.ExecuteSqlRawAsync(@"
        ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""PhoneNumber"" VARCHAR(20);
        ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""Department"" VARCHAR(100);
        CREATE TABLE IF NOT EXISTS ""BreakdownAssignees"" (
            ""Id"" SERIAL PRIMARY KEY,
            ""BreakdownId"" INTEGER NOT NULL REFERENCES ""Breakdowns""(""Id""),
            ""UserId"" INTEGER NOT NULL REFERENCES ""Users""(""Id""),
            ""Role"" VARCHAR(50) NOT NULL DEFAULT 'Technician',
            ""AssignedAt"" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
    ");
    return Results.Ok("Phone and assignees setup complete");
});

// GET breakdown assignees
app.MapGet("/breakdowns/{id}/assignees", async (OeeDbContext db, int id) =>
{
    var assignees = await db.BreakdownAssignees
        .Where(a => a.BreakdownId == id)
        .ToListAsync();

    var result = new List<object>();
    foreach (var a in assignees)
    {
        var user = await db.Users.FindAsync(a.UserId);
        if (user != null)
            result.Add(new
            {
                a.Id,
                a.BreakdownId,
                a.UserId,
                a.Role,
                a.AssignedAt,
                user.Email,
                user.PhoneNumber,
                user.Department
            });
    }
    return Results.Ok(result);
}).RequireAuthorization();

// POST add assignee to breakdown
app.MapPost("/breakdowns/{id}/assignees", async (OeeDbContext db, IConfiguration config, int id, AddAssigneeRequest req) =>
{
    var breakdown = await db.Breakdowns.FindAsync(id);
    if (breakdown == null) return Results.NotFound();

    // Check not already assigned
    var existing = await db.BreakdownAssignees
        .FirstOrDefaultAsync(a => a.BreakdownId == id && a.UserId == req.UserId);
    if (existing != null) return Results.BadRequest("User already assigned");

    db.BreakdownAssignees.Add(new BreakdownAssigneeEntity
    {
        BreakdownId = id,
        UserId = req.UserId,
        Role = req.Role,
        AssignedAt = DateTime.UtcNow
    });
    await db.SaveChangesAsync();

    // Send email alert
    var user = await db.Users.FindAsync(req.UserId);
    var machine = await db.Machines.FindAsync(breakdown.MachineId);
    if (user != null && machine != null)
    {
        try
        {
            var client = new SendGridClient(config["SendGrid:ApiKey"]);
            var from = new EmailAddress(config["SendGrid:FromEmail"], config["SendGrid:FromName"]);
            var msg = MailHelper.CreateSingleEmail(
                from, new EmailAddress(user.Email),
                $"[ASSIGNED] {machine.Name} Breakdown - {breakdown.Priority} Priority",
                $"You have been assigned to breakdown: {breakdown.Title}",
                $@"<h2>You have been assigned to a breakdown</h2>
                   <p><strong>Machine:</strong> {machine.Name}</p>
                   <p><strong>Breakdown:</strong> {breakdown.Title}</p>
                   <p><strong>Priority:</strong> {breakdown.Priority}</p>
                   <p><strong>Your Role:</strong> {req.Role}</p>
                   <p>Please attend immediately.</p>"
            );
            await client.SendEmailAsync(msg);
        }
        catch { }
    }

    return Results.Ok("Assignee added");
}).RequireAuthorization();

// DELETE assignee from breakdown
app.MapDelete("/breakdowns/{id}/assignees/{userId}", async (OeeDbContext db, int id, int userId) =>
{
    var assignee = await db.BreakdownAssignees
        .FirstOrDefaultAsync(a => a.BreakdownId == id && a.UserId == userId);
    if (assignee == null) return Results.NotFound();
    db.BreakdownAssignees.Remove(assignee);
    await db.SaveChangesAsync();
    return Results.Ok("Assignee removed");
}).RequireAuthorization();

// PUT update user profile (phone, department)
app.MapPut("/users/profile", async (OeeDbContext db, UpdateProfileRequest req) =>
{
    var user = await db.Users.FindAsync(req.UserId);
    if (user == null) return Results.NotFound();
    user.PhoneNumber = req.PhoneNumber;
    user.Department = req.Department;
    await db.SaveChangesAsync();
    return Results.Ok(new { user.Id, user.Email, user.PhoneNumber, user.Department, user.Role });
}).RequireAuthorization();

// GET all users with profile
app.MapGet("/users", async (OeeDbContext db) =>
{
    var users = await db.Users
        .Select(u => new { u.Id, u.Email, u.Role, u.PhoneNumber, u.Department })
        .ToListAsync();
    return Results.Ok(users);
}).RequireAuthorization();

// GET breakdown assignees
app.MapGet("/breakdowns/{id}/assignees", async (OeeDbContext db, int id) =>
{
    var assignees = await db.BreakdownAssignees
        .Where(a => a.BreakdownId == id)
        .ToListAsync();

    var result = new List<object>();
    foreach (var a in assignees)
    {
        var user = await db.Users.FindAsync(a.UserId);
        if (user != null)
            result.Add(new
            {
                a.Id,
                a.BreakdownId,
                a.UserId,
                a.Role,
                a.AssignedAt,
                user.Email,
                user.PhoneNumber,
                user.Department
            });
    }
    return Results.Ok(result);
}).RequireAuthorization();

// POST add assignee to breakdown
app.MapPost("/breakdowns/{id}/assignees", async (OeeDbContext db, IConfiguration config, int id, AddAssigneeRequest req) =>
{
    var breakdown = await db.Breakdowns.FindAsync(id);
    if (breakdown == null) return Results.NotFound();

    // Check not already assigned
    var existing = await db.BreakdownAssignees
        .FirstOrDefaultAsync(a => a.BreakdownId == id && a.UserId == req.UserId);
    if (existing != null) return Results.BadRequest("User already assigned");

    db.BreakdownAssignees.Add(new BreakdownAssigneeEntity
    {
        BreakdownId = id,
        UserId = req.UserId,
        Role = req.Role,
        AssignedAt = DateTime.UtcNow
    });
    await db.SaveChangesAsync();

    // Send email alert
    var user = await db.Users.FindAsync(req.UserId);
    var machine = await db.Machines.FindAsync(breakdown.MachineId);
    if (user != null && machine != null)
    {
        try
        {
            var client = new SendGridClient(config["SendGrid:ApiKey"]);
            var from = new EmailAddress(config["SendGrid:FromEmail"], config["SendGrid:FromName"]);
            var msg = MailHelper.CreateSingleEmail(
                from, new EmailAddress(user.Email),
                $"[ASSIGNED] {machine.Name} Breakdown - {breakdown.Priority} Priority",
                $"You have been assigned to breakdown: {breakdown.Title}",
                $@"<h2>You have been assigned to a breakdown</h2>
                   <p><strong>Machine:</strong> {machine.Name}</p>
                   <p><strong>Breakdown:</strong> {breakdown.Title}</p>
                   <p><strong>Priority:</strong> {breakdown.Priority}</p>
                   <p><strong>Your Role:</strong> {req.Role}</p>
                   <p>Please attend immediately.</p>"
            );
            await client.SendEmailAsync(msg);
        }
        catch { }
    }

    return Results.Ok("Assignee added");
}).RequireAuthorization();

// DELETE assignee from breakdown
app.MapDelete("/breakdowns/{id}/assignees/{userId}", async (OeeDbContext db, int id, int userId) =>
{
    var assignee = await db.BreakdownAssignees
        .FirstOrDefaultAsync(a => a.BreakdownId == id && a.UserId == userId);
    if (assignee == null) return Results.NotFound();
    db.BreakdownAssignees.Remove(assignee);
    await db.SaveChangesAsync();
    return Results.Ok("Assignee removed");
}).RequireAuthorization();

// PUT update user profile (phone, department)
app.MapPut("/users/profile", async (OeeDbContext db, UpdateProfileRequest req) =>
{
    var user = await db.Users.FindAsync(req.UserId);
    if (user == null) return Results.NotFound();
    user.PhoneNumber = req.PhoneNumber;
    user.Department = req.Department;
    await db.SaveChangesAsync();
    return Results.Ok(new { user.Id, user.Email, user.PhoneNumber, user.Department, user.Role });
}).RequireAuthorization();

// GET all users with profile
app.MapGet("/users", async (OeeDbContext db) =>
{
    var users = await db.Users
        .Select(u => new { u.Id, u.Email, u.Role, u.PhoneNumber, u.Department })
        .ToListAsync();
    return Results.Ok(users);
}).RequireAuthorization();
app.Run();

record RegisterRequest(string Email, string Password);
record LoginRequest(string Email, string Password);
record Machine(string Name, bool IsRunning, int UnitsProduced);
record SendCodeRequest(string Email, string Type);
record VerifyRegisterRequest(string Email, string Code, string Password);
record ForgotPasswordRequest(string Email);
record ResetPasswordRequest(string Email, string Code, string NewPassword);
record UpdateRoleRequest(string Role);
record MakeAdminRequest(string Email, string Secret);
record CreateBreakdownRequest(int MachineId, int ReportedByUserId, int? AssignedToUserId, string Title, string? Description, string BreakdownType, string Priority);
record UpdateBreakdownRequest(string Status, string? RootCause, string? CorrectiveAction, int? AssignedToUserId);
record CompletePmRequest(int CompletedByUserId, string? Notes);
record SetRoleRequest(string Email, string Secret, string Role);