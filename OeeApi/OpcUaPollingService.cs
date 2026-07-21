using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Opc.Ua;
using Opc.Ua.Client;
using Opc.Ua.Configuration;

// NOTE ON PACKAGE VERSION SENSITIVITY:
// The OPC Foundation .NET Standard client (OPCFoundation.NetStandard.Opc.Ua.Client)
// has changed some method signatures across major versions (particularly
// ApplicationInstance certificate setup and Session.Create overloads).
// This was written against the commonly-documented v1.4/1.5 API shape from
// memory — I could not run `dotnet restore`/`dotnet build` in this sandbox
// (no network access), so please run a local build after adding the package
// and adjust any signature mismatches the compiler points out. The official
// samples at https://github.com/OPCFoundation/UA-.NETStandard/tree/master/Applications
// are the best reference if something doesn't match your installed version.

/// <summary>Tracks the latest known value of each configured node per machine.</summary>
class OpcUaMachineCache
{
    public bool RunStatus;
    public long? UnitCount;
    public long? GoodUnits;
    public bool FaultStatus;
}

public class OpcUaPollingService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly MachineStateStore _stateStore;
    private readonly ILogger<OpcUaPollingService> _logger;
    private readonly ConcurrentDictionary<int, OpcUaMachineCache> _cache = new();
    private ApplicationConfiguration? _appConfig;

    public OpcUaPollingService(IServiceScopeFactory scopeFactory, MachineStateStore stateStore, ILogger<OpcUaPollingService> logger)
    {
        _scopeFactory = scopeFactory;
        _stateStore = stateStore;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

        List<int> machineIds;
        using (var scope = _scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<OeeDbContext>();
            machineIds = await db.Machines
                .Where(m => m.ConnectionType == "OPCUA" && m.OpcUaEndpoint != null)
                .Select(m => m.Id)
                .ToListAsync(stoppingToken);
        }

        // MVP scope: one long-lived task per machine that was configured for
        // OPC-UA at startup. Adding a new OPC-UA machine currently requires
        // an app restart to pick it up — a "reload connections" admin
        // endpoint would be the natural next step if this becomes a pain point.
        var tasks = machineIds.Select(id => RunMachineLoopAsync(id, stoppingToken)).ToArray();
        if (tasks.Length > 0)
            await Task.WhenAll(tasks);
        else
            await Task.Delay(Timeout.Infinite, stoppingToken).ContinueWith(_ => { });
    }

    private async Task<ApplicationConfiguration> GetOrCreateAppConfigAsync()
    {
        if (_appConfig != null) return _appConfig;

        var config = new ApplicationConfiguration
        {
            ApplicationName = "OeeApiOpcUaClient",
            ApplicationType = ApplicationType.Client,
            SecurityConfiguration = new SecurityConfiguration
            {
                ApplicationCertificate = new CertificateIdentifier(),
                AutoAcceptUntrustedCertificates = true, // MVP: most factory-floor OPC-UA servers use self-signed certs.
                RejectSHA1SignedCertificates = false,
                AddAppCertToTrustedStore = true,
            },
            TransportQuotas = new TransportQuotas { OperationTimeout = 15000 },
            ClientConfiguration = new ClientConfiguration { DefaultSessionTimeout = 60000 },
        };
        await config.Validate(ApplicationType.Client);

        var application = new ApplicationInstance
        {
            ApplicationName = "OeeApiOpcUaClient",
            ApplicationType = ApplicationType.Client,
            ApplicationConfiguration = config,
        };
        await application.CheckApplicationInstanceCertificate(false, 0);

        _appConfig = config;
        return config;
    }

    private static NodeId ResolveNodeId(string raw, int namespaceIndex)
    {
        // Accepts either a fully-qualified id ("ns=2;s=RunStatus") or a bare
        // tag name paired with the machine's configured Namespace index.
        if (raw.StartsWith("ns=", StringComparison.OrdinalIgnoreCase) || raw.StartsWith("i=", StringComparison.OrdinalIgnoreCase))
            return NodeId.Parse(raw);
        return new NodeId(raw, (ushort)namespaceIndex);
    }

    private async Task RunMachineLoopAsync(int machineId, CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            Session? session = null;
            Subscription? subscription = null;
            try
            {
                MachineEntity? machine;
                using (var scope = _scopeFactory.CreateScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<OeeDbContext>();
                    machine = await db.Machines.FindAsync(new object[] { machineId }, ct);
                }

                if (machine == null || machine.ConnectionType != "OPCUA" || string.IsNullOrWhiteSpace(machine.OpcUaEndpoint))
                {
                    await Task.Delay(TimeSpan.FromMinutes(1), ct);
                    continue;
                }

                var config = await GetOrCreateAppConfigAsync();
                var endpointDescription = CoreClientUtils.SelectEndpoint(config, machine.OpcUaEndpoint, useSecurity: false);
                var endpointConfiguration = EndpointConfiguration.Create(config);
                var endpoint = new ConfiguredEndpoint(null, endpointDescription, endpointConfiguration);

                session = await Session.Create(config, endpoint, false, $"OeeApi-{machineId}", 60000, null, null);

                var cache = _cache.GetOrAdd(machineId, _ => new OpcUaMachineCache());
                var state = _stateStore.GetOrAdd(machineId);

                subscription = new Subscription(session.DefaultSubscription) { PublishingInterval = 1000 };
                session.AddSubscription(subscription);
                subscription.Create();

                void Flush() => LiveReadingProcessor.RecordSample(state, cache.RunStatus, cache.UnitCount, cache.GoodUnits);

                AddMonitoredItem(subscription, machine.OpcUaNodeRunStatus, machine.OpcUaNamespace, "RunStatus", value =>
                {
                    cache.RunStatus = Convert.ToBoolean(value);
                    Flush();
                });
                AddMonitoredItem(subscription, machine.OpcUaNodeUnitCount, machine.OpcUaNamespace, "UnitCount", value =>
                {
                    cache.UnitCount = Convert.ToInt64(value);
                    Flush();
                });
                AddMonitoredItem(subscription, machine.OpcUaNodeGoodUnits, machine.OpcUaNamespace, "GoodUnits", value =>
                {
                    cache.GoodUnits = Convert.ToInt64(value);
                    Flush();
                });
                AddMonitoredItem(subscription, machine.OpcUaNodeFaultStatus, machine.OpcUaNamespace, "FaultStatus", value =>
                {
                    cache.FaultStatus = Convert.ToBoolean(value);
                });

                subscription.ApplyChanges();

                await UpdateHealthAsync(machineId, connected: true, error: null, ct);
                _logger.LogInformation("OPC-UA subscription active for machine {MachineId} at {Endpoint}", machineId, machine.OpcUaEndpoint);

                // Keep the session/subscription alive; periodically flush a
                // snapshot into OeeReadings and refresh the health timestamp.
                while (!ct.IsCancellationRequested && session.Connected)
                {
                    await Task.Delay(TimeSpan.FromSeconds(30), ct);

                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<OeeDbContext>();
                    var m = await db.Machines.FindAsync(new object[] { machineId }, ct);
                    if (m == null) break;

                    m.IsRunning = cache.RunStatus;
                    m.LastConnectedAt = DateTime.UtcNow;
                    m.LastConnectionError = cache.FaultStatus ? "Machine reports fault status" : null;

                    if ((DateTime.UtcNow - state.SnapshotStartUtc).TotalMinutes >= Math.Max(1, m.SnapshotIntervalMinutes))
                    {
                        var reading = LiveReadingProcessor.BuildSnapshotAndReset(state, machineId, m.IdealRate);
                        if (reading != null) db.OeeReadings.Add(reading);
                    }
                    await db.SaveChangesAsync(ct);
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "OPC-UA session for machine {MachineId} failed", machineId);
                await UpdateHealthAsync(machineId, connected: false, error: ex.Message, ct);
            }
            finally
            {
                try { subscription?.Delete(true); } catch { /* best effort cleanup */ }
                try { session?.Close(); } catch { /* best effort cleanup */ }
                session?.Dispose();
            }

            // Reconnect backoff before trying again.
            try { await Task.Delay(TimeSpan.FromSeconds(20), ct); } catch (OperationCanceledException) { break; }
        }
    }

    private void AddMonitoredItem(Subscription subscription, string? nodeIdRaw, int namespaceIndex, string name, Action<object> onValue)
    {
        if (string.IsNullOrWhiteSpace(nodeIdRaw)) return; // not configured for this machine, skip

        var item = new MonitoredItem(subscription.DefaultItem)
        {
            DisplayName = name,
            StartNodeId = ResolveNodeId(nodeIdRaw, namespaceIndex),
            AttributeId = Attributes.Value,
            SamplingInterval = 1000,
        };
        item.Notification += (monitoredItem, args) =>
        {
            foreach (var value in monitoredItem.DequeueValues())
            {
                if (value.Value != null && StatusCode.IsGood(value.StatusCode))
                    onValue(value.Value);
            }
        };
        subscription.AddItem(item);
    }

    private async Task UpdateHealthAsync(int machineId, bool connected, string? error, CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<OeeDbContext>();
            var m = await db.Machines.FindAsync(new object[] { machineId }, ct);
            if (m == null) return;
            if (connected) m.LastConnectedAt = DateTime.UtcNow;
            m.LastConnectionError = error;
            await db.SaveChangesAsync(ct);
        }
        catch
        {
            // best-effort health reporting only; never let this crash the poll loop
        }
    }
}
