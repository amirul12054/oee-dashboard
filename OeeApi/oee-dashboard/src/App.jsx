import { useEffect, useState } from "react";
import {
  Box, Card, CardContent, Chip, CircularProgress,
  Container, Grid, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography,
  Button,
} from "@mui/material";
import FactoryIcon from "@mui/icons-material/Factory";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import Login from "./Login";
import Register from "./Register";
import ForgotPassword from "./ForgotPassword";
import CsvImport from "./CsvImport";
import OeeCharts from "./OeeCharts";
import AdminPanel from "./AdminPanel";
import API_URL from "./config";
import MaintenanceTab from "./MaintenanceTab";
import ProfilePage from "./ProfilePage";


function parseToken(token) {
  try {
    const base64 = token.split(".")[1];
    const decoded = JSON.parse(atob(base64));
    return {
      email: decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
      role: decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]
    };
  } catch {
    return { email: "", role: "" };
  }
}

function calculateOEE(machine) {
  const availability = machine.runTimeMinutes / machine.plannedTimeMinutes;
  const performance = machine.actualRate / machine.idealRate;
  const quality = machine.goodUnits / machine.unitsProduced;
  return availability * performance * quality * 100;
}

function getOEEColor(oee) {
  if (oee >= 85) return "success";
  if (oee >= 60) return "warning";
  return "error";
}

function getOEEHexColor(oee) {
  if (oee >= 85) return "#2e7d32";
  if (oee >= 60) return "#ed6c02";
  return "#d32f2f";
}

function OEEGauge({ value }) {
  const color = getOEEHexColor(value);
  return (
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      <CircularProgress variant="determinate" value={100} size={80}
        sx={{ color: "#f0f0f0", position: "absolute" }} />
      <CircularProgress variant="determinate" value={value} size={80}
        sx={{ color }} />
      <Box sx={{
        top: 0, left: 0, bottom: 0, right: 0, position: "absolute",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <Typography variant="caption" sx={{ color, fontWeight: "bold" }}>
          {value.toFixed(1)}%
        </Typography>
      </Box>
    </Box>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("oee_token") || "");
  const [page, setPage] = useState("login");
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const userInfo = parseToken(token);
  const [showImport, setShowImport] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  if (showProfile) return (
    <ProfilePage onClose={() => setShowProfile(false)} />
  );

  const fetchMachines = () => {
    const storedToken = localStorage.getItem("oee_token");
    fetch(`${API_URL}/machines`, {
      headers: { Authorization: `Bearer ${storedToken}` }
    })
      .then((res) => {
        if (res.status === 401) {
          localStorage.removeItem("oee_token");
          setToken("");
          setLoading(false);
          return null;
        }
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setMachines(data);
        setLoading(false);
        setLastUpdated(new Date());
      })
      .catch(() => {
        setLoading(false);
      });
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!token) return;
    fetchMachines();
    const interval = setInterval(fetchMachines, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const handleLogin = (newToken) => {
    localStorage.setItem("oee_token", newToken);
    setToken(newToken);
  };

  if (!token) {
    if (page === "register") {
      return <Register onBackToLogin={() => setPage("login")} />;
    }
    if (page === "forgot") {
      return <ForgotPassword onBackToLogin={() => setPage("login")} />;
    }
    return (
      <Login
        onLogin={handleLogin}
        onRegister={() => setPage("register")}
        onForgotPassword={() => setPage("forgot")}
      />
    );
  }
  if (showImport) return (
    <Box sx={{ backgroundColor: "#f5f5f5", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="lg">
        <CsvImport onClose={() => { setShowImport(false); fetchMachines(); }} />
      </Container>
    </Box>
  );
  if (showAdmin) return (
    <Box sx={{ backgroundColor: "#f5f5f5", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="lg">
        <AdminPanel
          onClose={() => { setShowAdmin(false); fetchMachines(); }}
          currentUserEmail={userInfo.email}
        />
      </Container>
    </Box>
  );
  if (showMaintenance) return (
    <MaintenanceTab
      machines={machines}
      onClose={() => { setShowMaintenance(false); fetchMachines(); }}
    />
  );
  if (loading) return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
      <CircularProgress />
    </Box>

  );

  const averageOEE =
    machines.reduce((sum, m) => sum + calculateOEE(m), 0) / machines.length;
  const runningCount = machines.filter((m) => m.isRunning).length;

  return (
    <Box sx={{ backgroundColor: "#f5f5f5", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="lg">

        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <FactoryIcon sx={{ fontSize: 40, color: "#1976d2" }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: "bold" }}>OEE Dashboard</Typography>
              <Typography variant="body2" color="text.secondary">
                Real-time machine performance monitoring
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ textAlign: "right", cursor: "pointer" }} onClick={() => setShowProfile(true)}>
              <Typography variant="body2" sx={{ fontWeight: "bold", color: "#1976d2" }}>
                {userInfo.email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Role: {userInfo.role} · Last updated: {lastUpdated.toLocaleTimeString()}
              </Typography>
            </Box>
            {userInfo.role === "engineer" && (
              <Button variant="contained" size="small"
                onClick={() => setShowImport(true)}>
                Import CSV
              </Button>
            )}
            {userInfo.role === "engineer" && (
              <Button variant="outlined" size="small"
                onClick={() => setShowAdmin(true)}>
                Admin Panel
              </Button>
            )}
            <Button variant="outlined" size="small" onClick={() => {
              localStorage.removeItem("oee_token");
              setToken("");
            }}>Logout</Button>
            <Button variant="outlined" size="small" color="warning"
              onClick={() => setShowMaintenance(true)}>
              Maintenance
            </Button>
          </Box>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={2}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Factory Average OEE</Typography>
                <Typography variant="h3" sx={{ fontWeight: "bold", color: getOEEHexColor(averageOEE) }}>
                  {averageOEE.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">Target: 85%</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={2}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Machines Running</Typography>
                <Typography variant="h3" sx={{ fontWeight: "bold" }} color="success.main">
                  {runningCount}/{machines.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {machines.length - runningCount} machine(s) stopped
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={2}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>Total Units Produced</Typography>
                <Typography variant="h3" sx={{ fontWeight: "bold" }} color="primary">
                  {machines.reduce((sum, m) => sum + m.unitsProduced, 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Good units: {machines.reduce((sum, m) => sum + m.goodUnits, 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Machine Table */}
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#1976d2" }}>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Machine</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Status</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Availability</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Performance</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Quality</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>OEE</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {machines.map((machine) => {
                const availability = (machine.runTimeMinutes / machine.plannedTimeMinutes) * 100;
                const performance = (machine.actualRate / machine.idealRate) * 100;
                const quality = (machine.goodUnits / machine.unitsProduced) * 100;
                const oee = calculateOEE(machine);
                return (
                  <TableRow key={machine.id} hover>
                    <TableCell><Typography sx={{ fontWeight: "bold" }}>{machine.name}</Typography></TableCell>
                    <TableCell>
                      <Chip
                        icon={machine.isRunning ? <CheckCircleIcon /> : <CancelIcon />}
                        label={machine.isRunning ? "Running" : "Stopped"}
                        color={machine.isRunning ? "success" : "error"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={`${availability.toFixed(1)}%`}
                        color={getOEEColor(availability)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip label={`${performance.toFixed(1)}%`}
                        color={getOEEColor(performance)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip label={`${quality.toFixed(1)}%`}
                        color={getOEEColor(quality)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell><OEEGauge value={oee} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        {/* OEE Charts */}
        <OeeCharts machines={machines} />
      </Container>


    </Box>

  );
}