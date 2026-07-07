import { useEffect, useState } from "react";
import {
    Box, Card, CardContent, Typography, Button, Chip,
    Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Select,
    MenuItem, FormControl, InputLabel, Alert, Tabs, Tab,
    IconButton
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BuildIcon from "@mui/icons-material/Build";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import API_URL from "./config";

const token = () => localStorage.getItem("oee_token");

function parseToken(t) {
    try {
        const base64 = t.split(".")[1];
        const decoded = JSON.parse(atob(base64));
        return {
            userId: parseInt(decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"]),
            email: decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
            role: decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]
        };
    } catch { return { userId: 0, email: "", role: "" }; }
}

export default function MaintenanceTab({ machines, onClose }) {
    const [tab, setTab] = useState(0);
    const [breakdowns, setBreakdowns] = useState([]);
    const [pmSchedules, setPmSchedules] = useState([]);
    const [eightDReports, setEightDReports] = useState([]);
    const [summary, setSummary] = useState(null);
    const [users, setUsers] = useState([]);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const userInfo = parseToken(token());

    // Breakdown dialog
    const [showAddBreakdown, setShowAddBreakdown] = useState(false);
    const [newBreakdown, setNewBreakdown] = useState({
        machineId: "", title: "", description: "",
        breakdownType: "Unplanned", priority: "Medium",
        assignedToUserId: ""
    });

    // Close breakdown dialog
    const [showCloseBreakdown, setShowCloseBreakdown] = useState(false);
    const [selectedBreakdown, setSelectedBreakdown] = useState(null);
    const [closeData, setCloseData] = useState({
        status: "Closed", rootCause: "", correctiveAction: "", assignedToUserId: ""
    });

    // PM dialog
    const [showAddPm, setShowAddPm] = useState(false);
    const [newPm, setNewPm] = useState({
        machineId: "", title: "", description: "",
        type: "PM", frequencyDays: 30, nextDueAt: "", assignedToUserId: ""
    });

    // 8D dialog
    const [show8D, setShow8D] = useState(false);
    const [selected8D, setSelected8D] = useState(null);

    const fetchAll = async () => {
        const headers = { Authorization: `Bearer ${token()}` };
        const [b, p, r, s, u] = await Promise.all([
            fetch(`${API_URL}/breakdowns`, { headers }).then(r => r.json()),
            fetch(`${API_URL}/pm-schedules`, { headers }).then(r => r.json()),
            fetch(`${API_URL}/8d-reports`, { headers }).then(r => r.json()),
            fetch(`${API_URL}/maintenance/summary`, { headers }).then(r => r.json()),
            fetch(`${API_URL}/admin/users`, { headers }).then(r => r.json()),
        ]);
        setBreakdowns(Array.isArray(b) ? b : []);
        setPmSchedules(Array.isArray(p) ? p : []);
        setEightDReports(Array.isArray(r) ? r : []);
        setSummary(s);
        setUsers(Array.isArray(u) ? u : []);
    };

    useEffect(() => { fetchAll(); }, []);

    const handleCreateBreakdown = async () => {
        if (!newBreakdown.machineId || !newBreakdown.title) {
            setError("Machine and title are required"); return;
        }
        const res = await fetch(`${API_URL}/breakdowns`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
            body: JSON.stringify({
                machineId: parseInt(newBreakdown.machineId),
                reportedByUserId: userInfo.userId,
                assignedToUserId: newBreakdown.assignedToUserId ? parseInt(newBreakdown.assignedToUserId) : null,
                title: newBreakdown.title,
                description: newBreakdown.description,
                breakdownType: newBreakdown.breakdownType,
                priority: newBreakdown.priority
            })
        });
        if (res.ok) {
            setSuccess("Breakdown logged and alert sent");
            setShowAddBreakdown(false);
            setNewBreakdown({ machineId: "", title: "", description: "", breakdownType: "Unplanned", priority: "Medium", assignedToUserId: "" });
            fetchAll();
        } else setError("Failed to log breakdown");
    };

    const handleCloseBreakdown = async () => {
        const res = await fetch(`${API_URL}/breakdowns/${selectedBreakdown.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
            body: JSON.stringify({
                status: closeData.status,
                rootCause: closeData.rootCause,
                correctiveAction: closeData.correctiveAction,
                assignedToUserId: closeData.assignedToUserId ? parseInt(closeData.assignedToUserId) : null
            })
        });
        if (res.ok) {
            setSuccess("Breakdown updated");
            setShowCloseBreakdown(false);
            fetchAll();
        } else setError("Failed to update breakdown");
    };

    const handleCreatePm = async () => {
        if (!newPm.machineId || !newPm.title || !newPm.nextDueAt) {
            setError("Machine, title and due date are required"); return;
        }
        const res = await fetch(`${API_URL}/pm-schedules`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
            body: JSON.stringify({
                machineId: parseInt(newPm.machineId),
                title: newPm.title,
                description: newPm.description,
                type: newPm.type,
                frequencyDays: parseInt(newPm.frequencyDays),
                nextDueAt: new Date(newPm.nextDueAt).toISOString(),
                assignedToUserId: newPm.assignedToUserId ? parseInt(newPm.assignedToUserId) : null
            })
        });
        if (res.ok) {
            setSuccess("PM schedule created");
            setShowAddPm(false);
            fetchAll();
        } else setError("Failed to create PM schedule");
    };

    const handleCompletePm = async (pmId) => {
        const res = await fetch(`${API_URL}/pm-schedules/${pmId}/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
            body: JSON.stringify({ completedByUserId: userInfo.userId, notes: "" })
        });
        if (res.ok) { setSuccess("PM marked as complete"); fetchAll(); }
        else setError("Failed to complete PM");
    };

    const handleUpdate8D = async () => {
        const res = await fetch(`${API_URL}/8d-reports/${selected8D.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
            body: JSON.stringify(selected8D)
        });
        if (res.ok) { setSuccess("8D report updated"); setShow8D(false); fetchAll(); }
        else setError("Failed to update 8D report");
    };

    const getMachineName = (id) => machines.find(m => m.id === id)?.name || `Machine ${id}`;
    const getUserEmail = (id) => users.find(u => u.id === id)?.email || `User ${id}`;

    const priorityColor = (p) => p === "High" ? "error" : p === "Medium" ? "warning" : "success";
    const statusColor = (s) => s === "Open" ? "error" : s === "In Progress" ? "warning" : "success";
    const isOverdue = (date) => new Date(date) < new Date();

    return (
        <Box sx={{ backgroundColor: "#f5f5f5", minHeight: "100vh", py: 4 }}>
            <Box sx={{ maxWidth: 1200, mx: "auto", px: 3 }}>

                {/* Header */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
                    <IconButton onClick={onClose}><ArrowBackIcon /></IconButton>
                    <BuildIcon sx={{ fontSize: 36, color: "#1976d2" }} />
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: "bold" }}>Maintenance</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Breakdown tracking, PM schedules, 8D reports
                        </Typography>
                    </Box>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

                {/* Summary Cards */}
                {summary && (
                    <Box sx={{ display: "flex", gap: 2, mb: 4, flexWrap: "wrap" }}>
                        <Card elevation={2} sx={{ flex: 1, minWidth: 150 }}>
                            <CardContent>
                                <Typography color="text.secondary" variant="body2">Open Breakdowns</Typography>
                                <Typography variant="h4" sx={{ fontWeight: "bold", color: summary.openBreakdowns > 0 ? "#d32f2f" : "#2e7d32" }}>
                                    {summary.openBreakdowns}
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card elevation={2} sx={{ flex: 1, minWidth: 150 }}>
                            <CardContent>
                                <Typography color="text.secondary" variant="body2">Avg MTTR (min)</Typography>
                                <Typography variant="h4" sx={{ fontWeight: "bold", color: "#1976d2" }}>
                                    {summary.avgMttr}
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card elevation={2} sx={{ flex: 1, minWidth: 150 }}>
                            <CardContent>
                                <Typography color="text.secondary" variant="body2">Total Breakdowns</Typography>
                                <Typography variant="h4" sx={{ fontWeight: "bold" }}>{summary.totalBreakdowns}</Typography>
                            </CardContent>
                        </Card>
                        <Card elevation={2} sx={{ flex: 1, minWidth: 150 }}>
                            <CardContent>
                                <Typography color="text.secondary" variant="body2">Overdue PM</Typography>
                                <Typography variant="h4" sx={{ fontWeight: "bold", color: summary.overduepm > 0 ? "#d32f2f" : "#2e7d32" }}>
                                    {summary.overduepm}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>
                )}

                {/* Tabs */}
                <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3 }}>
                    <Tab label={`Breakdowns (${breakdowns.length})`} />
                    <Tab label={`PM Schedule (${pmSchedules.length})`} />
                    <Tab label={`8D Reports (${eightDReports.length})`} />
                </Tabs>

                {/* BREAKDOWNS TAB */}
                {tab === 0 && (
                    <Box>
                        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
                            <Button variant="contained" startIcon={<AddIcon />}
                                onClick={() => setShowAddBreakdown(true)} color="error">
                                Log Breakdown
                            </Button>
                        </Box>
                        <TableContainer component={Paper} elevation={2}>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: "#d32f2f" }}>
                                        {["Machine", "Title", "Type", "Priority", "Status", "Downtime", "Reported", "Actions"].map(h => (
                                            <TableCell key={h} sx={{ color: "white", fontWeight: "bold" }}>{h}</TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {breakdowns.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={8} align="center">No breakdowns recorded</TableCell>
                                        </TableRow>
                                    )}
                                    {breakdowns.map((b) => (
                                        <TableRow key={b.id} hover>
                                            <TableCell sx={{ fontWeight: "bold" }}>{getMachineName(b.machineId)}</TableCell>
                                            <TableCell>{b.title}</TableCell>
                                            <TableCell><Chip label={b.breakdownType} size="small" /></TableCell>
                                            <TableCell><Chip label={b.priority} color={priorityColor(b.priority)} size="small" /></TableCell>
                                            <TableCell><Chip label={b.status} color={statusColor(b.status)} size="small" /></TableCell>
                                            <TableCell>{b.downtimeMinutes ? `${b.downtimeMinutes} min` : "Ongoing"}</TableCell>
                                            <TableCell>{new Date(b.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                {b.status === "Open" && (
                                                    <Button size="small" variant="outlined"
                                                        onClick={() => { setSelectedBreakdown(b); setCloseData({ status: "Closed", rootCause: "", correctiveAction: "", assignedToUserId: b.assignedToUserId || "" }); setShowCloseBreakdown(true); }}>
                                                        Update
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}

                {/* PM SCHEDULE TAB */}
                {tab === 1 && (
                    <Box>
                        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
                            <Button variant="contained" startIcon={<AddIcon />}
                                onClick={() => setShowAddPm(true)}>
                                Add PM Schedule
                            </Button>
                        </Box>
                        <TableContainer component={Paper} elevation={2}>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: "#1976d2" }}>
                                        {["Machine", "Title", "Type", "Frequency", "Next Due", "Last Done", "Status", "Actions"].map(h => (
                                            <TableCell key={h} sx={{ color: "white", fontWeight: "bold" }}>{h}</TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {pmSchedules.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={8} align="center">No PM schedules created</TableCell>
                                        </TableRow>
                                    )}
                                    {pmSchedules.map((p) => (
                                        <TableRow key={p.id} hover>
                                            <TableCell sx={{ fontWeight: "bold" }}>{getMachineName(p.machineId)}</TableCell>
                                            <TableCell>{p.title}</TableCell>
                                            <TableCell><Chip label={p.type} color="primary" size="small" /></TableCell>
                                            <TableCell>Every {p.frequencyDays} days</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={new Date(p.nextDueAt).toLocaleDateString()}
                                                    color={isOverdue(p.nextDueAt) ? "error" : "success"}
                                                    size="small"
                                                    icon={isOverdue(p.nextDueAt) ? <WarningIcon /> : <CheckCircleIcon />}
                                                />
                                            </TableCell>
                                            <TableCell>{p.lastDoneAt ? new Date(p.lastDoneAt).toLocaleDateString() : "Never"}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={isOverdue(p.nextDueAt) ? "Overdue" : "On Track"}
                                                    color={isOverdue(p.nextDueAt) ? "error" : "success"}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button size="small" variant="contained" color="success"
                                                    onClick={() => handleCompletePm(p.id)}>
                                                    Done
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}

                {/* 8D REPORTS TAB */}
                {tab === 2 && (
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            8D reports are automatically created for breakdowns lasting more than 1 hour.
                        </Typography>
                        <TableContainer component={Paper} elevation={2}>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: "#7b1fa2" }}>
                                        {["Breakdown ID", "Problem", "Status", "Created", "Actions"].map(h => (
                                            <TableCell key={h} sx={{ color: "white", fontWeight: "bold" }}>{h}</TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {eightDReports.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center">
                                                No 8D reports yet. They are auto-created for breakdowns &gt; 1 hour.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {eightDReports.map((r) => (
                                        <TableRow key={r.id} hover>
                                            <TableCell>BD-{r.breakdownId}</TableCell>
                                            <TableCell>{r.d2_Problem || "Not filled"}</TableCell>
                                            <TableCell><Chip label={r.status} color={r.status === "Open" ? "error" : "success"} size="small" /></TableCell>
                                            <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <Button size="small" variant="outlined"
                                                    onClick={() => { setSelected8D({ ...r }); setShow8D(true); }}>
                                                    Fill 8D
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}
            </Box>

            {/* Log Breakdown Dialog */}
            <Dialog open={showAddBreakdown} onClose={() => setShowAddBreakdown(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ backgroundColor: "#d32f2f", color: "white" }}>
                    Log New Breakdown
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Machine *</InputLabel>
                            <Select value={newBreakdown.machineId} label="Machine *"
                                onChange={(e) => setNewBreakdown({ ...newBreakdown, machineId: e.target.value })}>
                                {machines.map(m => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <TextField label="Breakdown Title *" value={newBreakdown.title}
                            onChange={(e) => setNewBreakdown({ ...newBreakdown, title: e.target.value })} fullWidth />
                        <TextField label="Description" multiline rows={3} value={newBreakdown.description}
                            onChange={(e) => setNewBreakdown({ ...newBreakdown, description: e.target.value })} fullWidth />
                        <FormControl fullWidth>
                            <InputLabel>Type</InputLabel>
                            <Select value={newBreakdown.breakdownType} label="Type"
                                onChange={(e) => setNewBreakdown({ ...newBreakdown, breakdownType: e.target.value })}>
                                <MenuItem value="Unplanned">Unplanned</MenuItem>
                                <MenuItem value="Planned">Planned</MenuItem>
                                <MenuItem value="Electrical">Electrical</MenuItem>
                                <MenuItem value="Mechanical">Mechanical</MenuItem>
                                <MenuItem value="Software">Software</MenuItem>
                                <MenuItem value="Tooling">Tooling</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Priority</InputLabel>
                            <Select value={newBreakdown.priority} label="Priority"
                                onChange={(e) => setNewBreakdown({ ...newBreakdown, priority: e.target.value })}>
                                <MenuItem value="Low">Low</MenuItem>
                                <MenuItem value="Medium">Medium</MenuItem>
                                <MenuItem value="High">High</MenuItem>
                                <MenuItem value="Critical">Critical</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Assign To (optional)</InputLabel>
                            <Select value={newBreakdown.assignedToUserId} label="Assign To (optional)"
                                onChange={(e) => setNewBreakdown({ ...newBreakdown, assignedToUserId: e.target.value })}>
                                <MenuItem value="">Nobody</MenuItem>
                                {users.map(u => <MenuItem key={u.id} value={u.id}>{u.email}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowAddBreakdown(false)}>Cancel</Button>
                    <Button onClick={handleCreateBreakdown} variant="contained" color="error">Log Breakdown</Button>
                </DialogActions>
            </Dialog>

            {/* Close/Update Breakdown Dialog */}
            <Dialog open={showCloseBreakdown} onClose={() => setShowCloseBreakdown(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Update Breakdown — {selectedBreakdown?.title}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Status</InputLabel>
                            <Select value={closeData.status} label="Status"
                                onChange={(e) => setCloseData({ ...closeData, status: e.target.value })}>
                                <MenuItem value="Open">Open</MenuItem>
                                <MenuItem value="In Progress">In Progress</MenuItem>
                                <MenuItem value="Closed">Closed</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Assign To</InputLabel>
                            <Select value={closeData.assignedToUserId} label="Assign To"
                                onChange={(e) => setCloseData({ ...closeData, assignedToUserId: e.target.value })}>
                                <MenuItem value="">Nobody</MenuItem>
                                {users.map(u => <MenuItem key={u.id} value={u.id}>{u.email}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <TextField label="Root Cause" multiline rows={2} value={closeData.rootCause}
                            onChange={(e) => setCloseData({ ...closeData, rootCause: e.target.value })} fullWidth />
                        <TextField label="Corrective Action" multiline rows={2} value={closeData.correctiveAction}
                            onChange={(e) => setCloseData({ ...closeData, correctiveAction: e.target.value })} fullWidth />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowCloseBreakdown(false)}>Cancel</Button>
                    <Button onClick={handleCloseBreakdown} variant="contained">Update</Button>
                </DialogActions>
            </Dialog>

            {/* Add PM Dialog */}
            <Dialog open={showAddPm} onClose={() => setShowAddPm(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add PM/AM Schedule</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Machine *</InputLabel>
                            <Select value={newPm.machineId} label="Machine *"
                                onChange={(e) => setNewPm({ ...newPm, machineId: e.target.value })}>
                                {machines.map(m => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Type</InputLabel>
                            <Select value={newPm.type} label="Type"
                                onChange={(e) => setNewPm({ ...newPm, type: e.target.value })}>
                                <MenuItem value="PM">PM (Preventive Maintenance)</MenuItem>
                                <MenuItem value="AM">AM (Autonomous Maintenance)</MenuItem>
                                <MenuItem value="CM">CM (Corrective Maintenance)</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField label="Title *" value={newPm.title}
                            onChange={(e) => setNewPm({ ...newPm, title: e.target.value })} fullWidth />
                        <TextField label="Description" multiline rows={2} value={newPm.description}
                            onChange={(e) => setNewPm({ ...newPm, description: e.target.value })} fullWidth />
                        <TextField label="Frequency (days)" type="number" value={newPm.frequencyDays}
                            onChange={(e) => setNewPm({ ...newPm, frequencyDays: e.target.value })} fullWidth />
                        <TextField label="Next Due Date *" type="date" value={newPm.nextDueAt}
                            onChange={(e) => setNewPm({ ...newPm, nextDueAt: e.target.value })}
                            InputLabelProps={{ shrink: true }} fullWidth />
                        <FormControl fullWidth>
                            <InputLabel>Assign To</InputLabel>
                            <Select value={newPm.assignedToUserId} label="Assign To"
                                onChange={(e) => setNewPm({ ...newPm, assignedToUserId: e.target.value })}>
                                <MenuItem value="">Nobody</MenuItem>
                                {users.map(u => <MenuItem key={u.id} value={u.id}>{u.email}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowAddPm(false)}>Cancel</Button>
                    <Button onClick={handleCreatePm} variant="contained">Create Schedule</Button>
                </DialogActions>
            </Dialog>

            {/* 8D Report Dialog */}
            {selected8D && (
                <Dialog open={show8D} onClose={() => setShow8D(false)} maxWidth="md" fullWidth>
                    <DialogTitle sx={{ backgroundColor: "#7b1fa2", color: "white" }}>
                        8D Problem Solving Report — BD-{selected8D.breakdownId}
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
                            {[
                                { key: "d1_Team", label: "D1 — Team (who is working on this?)" },
                                { key: "d2_Problem", label: "D2 — Problem Description" },
                                { key: "d3_ContainmentAction", label: "D3 — Containment Action (immediate fix)" },
                                { key: "d4_RootCause", label: "D4 — Root Cause Analysis" },
                                { key: "d5_CorrectiveAction", label: "D5 — Corrective Action (permanent fix)" },
                                { key: "d6_Implementation", label: "D6 — Implementation Plan" },
                                { key: "d7_Prevention", label: "D7 — Prevention (how to avoid recurrence)" },
                                { key: "d8_Closure", label: "D8 — Closure & Congratulations" },
                            ].map(field => (
                                <TextField key={field.key} label={field.label} multiline rows={2}
                                    value={selected8D[field.key] || ""}
                                    onChange={(e) => setSelected8D({ ...selected8D, [field.key]: e.target.value })}
                                    fullWidth />
                            ))}
                            <FormControl fullWidth>
                                <InputLabel>Status</InputLabel>
                                <Select value={selected8D.status} label="Status"
                                    onChange={(e) => setSelected8D({ ...selected8D, status: e.target.value })}>
                                    <MenuItem value="Open">Open</MenuItem>
                                    <MenuItem value="In Progress">In Progress</MenuItem>
                                    <MenuItem value="Closed">Closed</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShow8D(false)}>Cancel</Button>
                        <Button onClick={handleUpdate8D} variant="contained" sx={{ backgroundColor: "#7b1fa2" }}>
                            Save 8D Report
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </Box>
    );
}