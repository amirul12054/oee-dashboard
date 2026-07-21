import { useEffect, useState } from "react";
import {
    Box, Card, CardContent, Typography, Button,
    Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, Chip, IconButton,
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Select, MenuItem, FormControl, InputLabel,
    Alert, Divider
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import LockResetIcon from "@mui/icons-material/LockReset";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import API_URL from "./config";
import InfoTip from "./InfoTip";
import ShiftCalendarPanel from "./ShiftCalendarPanel";

const API = API_URL
const token = () => localStorage.getItem("oee_token");

export default function AdminPanel({ onClose, currentUsername }) {
    const [users, setUsers] = useState([]);
    const [machines, setMachines] = useState([]);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [contacts, setContacts] = useState([]);
    const [showAddContact, setShowAddContact] = useState(false);
    const [newContact, setNewContact] = useState({
        name: "", role: "Technician", phoneNumber: "", department: ""
    });
    const [showEditMachine, setShowEditMachine] = useState(false);
    const [editMachineData, setEditMachineData] = useState(null);
    const [products, setProducts] = useState([]);




    // Add machine dialog
    const [showAddMachine, setShowAddMachine] = useState(false);
    const [newMachine, setNewMachine] = useState({
        name: "", isRunning: false, unitsProduced: 0,
        goodUnits: 0, plannedTimeMinutes: 480,
        runTimeMinutes: 0, idealRate: 0, actualRate: 0,
        connectionType: "CSV", opcUaEndpoint: "", opcUaNamespace: 2,
        opcUaNodeRunStatus: "", opcUaNodeUnitCount: "",
        opcUaNodeGoodUnits: "", opcUaNodeFaultStatus: "",
        modbusIp: "", modbusPort: 502, modbusSlaveId: 1,
        modbusRegRunStatus: "", modbusRegUnitCount: "",
        modbusRegGoodUnits: "", modbusRegFaultStatus: "",
        csvFilePath: "", csvAutoImport: false, snapshotIntervalMinutes: 5
    });


    // Edit role dialog
    const [editUser, setEditUser] = useState(null);
    const [newRole, setNewRole] = useState("");

    const fetchUsers = () => {
        fetch(`${API_URL}/users`, {
            headers: { Authorization: `Bearer ${token()}` }
        })
            .then((res) => res.json())
            .then(setUsers)
            .catch(() => setError("Failed to load users"));
    };

    const fetchMachines = () => {
        fetch(`${API}/machines`, {
            headers: { Authorization: `Bearer ${token()}` }
        })
            .then((res) => res.json())
            .then(setMachines)
            .catch(() => setError("Failed to load machines"));
    };

    const fetchProducts = () => {
        fetch(`${API}/products`, {
            headers: { Authorization: `Bearer ${token()}` }
        })
            .then((res) => res.json())
            .then(setProducts)
            .catch(() => { /* non-critical, quietly skip */ });
    };

    const handleProductSwitch = async (machineId, productId) => {
        const res = await fetch(`${API}/machines/${machineId}/current-product`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
            body: JSON.stringify({ productId: productId || null }),
        });
        if (res.ok) fetchMachines();
        else setError("Failed to switch product");
    };



    const handleUpdateRole = async () => {
        const res = await fetch(`${API}/admin/users/${editUser.id}/role`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token()}`
            },
            body: JSON.stringify({ role: newRole })
        });
        if (res.ok) {
            setSuccess(`Role updated to ${newRole}`);
            setEditUser(null);
            fetchUsers();
        } else {
            setError("Failed to update role");
        }
    };

    const handleDeleteUser = async (user) => {
        if (user.username === currentUsername) {
            setError("You cannot delete your own account");
            return;
        }
        if (!window.confirm(`Delete user ${user.username}?`)) return;
        const res = await fetch(`${API}/admin/users/${user.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token()}` }
        });
        if (res.ok) {
            setSuccess("User deleted");
            fetchUsers();
        } else {
            setError("Failed to delete user");
        }
    };
    const handleResetPassword = async (user) => {
        if (!window.confirm(`Reset password for ${user.username} to their username?`)) return;
        const res = await fetch(`${API_URL}/admin/users/${user.id}/reset-password`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token()}` }
        });
        if (res.ok) setSuccess(`Password reset to "${user.username}"`);
        else setError("Failed to reset password");
    };


    const handleAddMachine = async () => {
        if (!newMachine.name) { setError("Machine name is required"); return; }
        const res = await fetch(`${API_URL}/admin/machines`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
            body: JSON.stringify(newMachine)
        });
        if (res.ok) {
            setSuccess(`Machine ${newMachine.name} added`);
            setShowAddMachine(false);
            setNewMachine({
                name: "", isRunning: false, unitsProduced: 0,
                goodUnits: 0, plannedTimeMinutes: 480,
                runTimeMinutes: 0, idealRate: 0, actualRate: 0,
                connectionType: "CSV", opcUaEndpoint: "", opcUaNamespace: 2,
                opcUaNodeRunStatus: "", opcUaNodeUnitCount: "",
                opcUaNodeGoodUnits: "", opcUaNodeFaultStatus: "",
                modbusIp: "", modbusPort: 502, modbusSlaveId: 1,
                modbusRegRunStatus: "", modbusRegUnitCount: "",
                modbusRegGoodUnits: "", modbusRegFaultStatus: "",
                csvFilePath: "", csvAutoImport: false, snapshotIntervalMinutes: 5
            });
            fetchMachines();
        } else setError("Failed to add machine");
    };

    const handleEditMachineSave = async () => {
        const res = await fetch(`${API_URL}/admin/machines/${editMachineData.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
            body: JSON.stringify(editMachineData)
        });
        if (res.ok) {
            setSuccess(`Machine ${editMachineData.name} updated`);
            setShowEditMachine(false);
            fetchMachines();
        } else setError("Failed to update machine");
    };

    const handleDeleteMachine = async (machine) => {
        if (!window.confirm(`Delete machine ${machine.name}? This will also delete all its history.`)) return;
        const res = await fetch(`${API}/admin/machines/${machine.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token()}` }
        });
        if (res.ok) {
            setSuccess(`Machine ${machine.name} deleted`);
            fetchMachines();
        } else {
            const text = await res.text().catch(() => "");
            setError(text || `Failed to delete machine (HTTP ${res.status})`);
        }
    };
    const fetchContacts = () => {
        fetch(`${API_URL}/contacts`, { headers: { Authorization: `Bearer ${token()}` } })
            .then(r => r.json()).then(setContacts)
            .catch(() => setError("Failed to load contacts"));
    };

    const handleAddContact = async () => {
        if (!newContact.name) { setError("Name is required"); return; }
        const res = await fetch(`${API_URL}/contacts`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
            body: JSON.stringify(newContact)
        });
        if (res.ok) {
            setSuccess(`${newContact.name} added to contacts`);
            setShowAddContact(false);
            setNewContact({ name: "", role: "Technician", phoneNumber: "", department: "" });
            fetchContacts();
        } else setError("Failed to add contact");
    };

    const handleDeleteContact = async (contact) => {
        if (!window.confirm(`Delete ${contact.name} from contacts?`)) return;
        const res = await fetch(`${API_URL}/contacts/${contact.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token()}` }
        });
        if (res.ok) { setSuccess("Contact deleted"); fetchContacts(); }
        else setError("Failed to delete contact");
    };
    useEffect(() => { fetchUsers(); fetchMachines(); fetchContacts(); fetchProducts(); }, []);

    const MachineForm = ({ data, onChange }) => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField label="Machine Name *" value={data.name || ""}
                onChange={(e) => onChange({ ...data, name: e.target.value })} fullWidth />
            <TextField label="Ideal Rate (units/hour)" type="number" value={data.idealRate || 0}
                onChange={(e) => onChange({ ...data, idealRate: parseInt(e.target.value) })} fullWidth />
            <TextField label="Planned Time per Shift (minutes)" type="number" value={data.plannedTimeMinutes || 480}
                onChange={(e) => onChange({ ...data, plannedTimeMinutes: parseInt(e.target.value) })} fullWidth />
            <TextField label="Is Running" select value={(data.isRunning || false).toString()}
                onChange={(e) => onChange({ ...data, isRunning: e.target.value === "true" })} fullWidth>
                <MenuItem value="true">Running</MenuItem>
                <MenuItem value="false">Stopped</MenuItem>
            </TextField>

            {/* Connection Type */}
            <FormControl fullWidth>
                <InputLabel>Data Connection Type</InputLabel>
                <Select value={data.connectionType || "CSV"} label="Data Connection Type"
                    onChange={(e) => onChange({ ...data, connectionType: e.target.value })}>
                    <MenuItem value="CSV">📄 CSV Import (Basic)</MenuItem>
                    <MenuItem value="OPCUA">🔌 OPC-UA Auto Connect (Standard)</MenuItem>
                    <MenuItem value="Modbus">⚙️ Modbus TCP (Advanced)</MenuItem>
                </Select>
            </FormControl>

            {/* Live connection settings shared by OPC-UA and Modbus */}
            {(data.connectionType === "OPCUA" || data.connectionType === "Modbus") && (
                <Box sx={{ p: 2, border: "1px solid #9c27b0", borderRadius: 2, backgroundColor: "#faf5fc" }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1, color: "#9c27b0" }}>
                        📡 Live Data Settings
                    </Typography>
                    <TextField label="Snapshot Interval (minutes)" type="number" value={data.snapshotIntervalMinutes || 5}
                        onChange={(e) => onChange({ ...data, snapshotIntervalMinutes: parseInt(e.target.value) })}
                        helperText="How often live readings are saved as a data point (e.g. every 5 minutes). Shorter = more granular trend data."
                        fullWidth size="small" sx={{ mb: 1.5 }} />
                    {data.id && (
                        <Box sx={{ mt: 1 }}>
                            {data.lastConnectionError ? (
                                <Alert severity="error" sx={{ fontSize: "0.8rem" }}>
                                    Connection error: {data.lastConnectionError}
                                </Alert>
                            ) : data.lastConnectedAt ? (
                                <Alert severity="success" sx={{ fontSize: "0.8rem" }}>
                                    Last connected: {new Date(data.lastConnectedAt).toLocaleString()}
                                </Alert>
                            ) : (
                                <Alert severity="info" sx={{ fontSize: "0.8rem" }}>
                                    Not connected yet — save this machine and the background poller will pick it up shortly.
                                </Alert>
                            )}
                        </Box>
                    )}
                </Box>
            )}

            {/* CSV Settings */}
            {(data.connectionType === "CSV" || !data.connectionType) && (
                <Box sx={{ p: 2, border: "1px solid #e0e0e0", borderRadius: 2, backgroundColor: "#f9f9f9" }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
                        📄 CSV Import Settings
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                        Use the Import CSV button on the dashboard to upload machine data files manually.
                        OEE will be calculated from each imported file.
                    </Typography>
                    <TextField label="CSV Auto-Import File Path (optional)" value={data.csvFilePath || ""}
                        onChange={(e) => onChange({ ...data, csvFilePath: e.target.value })}
                        placeholder="e.g. C:\MachineData\CNC01_output.csv"
                        helperText="If set, system will watch this path for new files automatically"
                        fullWidth size="small" />
                </Box>
            )}

            {/* OPC-UA Settings */}
            {data.connectionType === "OPCUA" && (
                <Box sx={{ p: 2, border: "1px solid #1976d2", borderRadius: 2, backgroundColor: "#f0f7ff" }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1, color: "#1976d2" }}>
                        🔌 OPC-UA Connection Settings
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                        OPC-UA is supported by most modern PLCs (Siemens S7-1200/1500, Fanuc, Beckhoff, Mitsubishi iQ-R).
                        Enable OPC-UA server on your PLC first, then enter the connection details below.
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                        <TextField label="OPC-UA Endpoint URL *" value={data.opcUaEndpoint || ""}
                            onChange={(e) => onChange({ ...data, opcUaEndpoint: e.target.value })}
                            placeholder="opc.tcp://192.168.1.100:4840"
                            helperText="Format: opc.tcp://[PLC IP Address]:[Port, default 4840]"
                            fullWidth size="small" />
                        <TextField label="Namespace Index" type="number" value={data.opcUaNamespace || 2}
                            onChange={(e) => onChange({ ...data, opcUaNamespace: parseInt(e.target.value) })}
                            helperText="Usually 2 for user-defined tags. Check your PLC OPC-UA configuration."
                            fullWidth size="small" />
                        <TextField label="Node ID — Run Status" value={data.opcUaNodeRunStatus || ""}
                            onChange={(e) => onChange({ ...data, opcUaNodeRunStatus: e.target.value })}
                            placeholder="e.g. ns=2;s=Machine1.RunStatus"
                            helperText="Tag that returns 1=Running, 0=Stopped"
                            fullWidth size="small" />
                        <TextField label="Node ID — Unit Count" value={data.opcUaNodeUnitCount || ""}
                            onChange={(e) => onChange({ ...data, opcUaNodeUnitCount: e.target.value })}
                            placeholder="e.g. ns=2;s=Machine1.TotalCount"
                            helperText="Tag for total units produced this shift"
                            fullWidth size="small" />
                        <TextField label="Node ID — Good Units" value={data.opcUaNodeGoodUnits || ""}
                            onChange={(e) => onChange({ ...data, opcUaNodeGoodUnits: e.target.value })}
                            placeholder="e.g. ns=2;s=Machine1.GoodCount"
                            helperText="Tag for good/pass units (leave empty if not available)"
                            fullWidth size="small" />
                        <TextField label="Node ID — Fault Status" value={data.opcUaNodeFaultStatus || ""}
                            onChange={(e) => onChange({ ...data, opcUaNodeFaultStatus: e.target.value })}
                            placeholder="e.g. ns=2;s=Machine1.FaultCode"
                            helperText="Tag for fault/alarm code (optional, used for downtime tracking)"
                            fullWidth size="small" />
                    </Box>
                </Box>
            )}

            {/* Modbus Settings */}
            {data.connectionType === "Modbus" && (
                <Box sx={{ p: 2, border: "1px solid #ed6c02", borderRadius: 2, backgroundColor: "#fff8f0" }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1, color: "#ed6c02" }}>
                        ⚙️ Modbus TCP Connection Settings
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                        Modbus TCP works with most industrial equipment (Siemens S7-200/300/400, Allen Bradley,
                        Schneider, older PLCs). Your PLC must have Modbus TCP server enabled.
                        Register addresses are in decimal format.
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                        <TextField label="PLC IP Address *" value={data.modbusIp || ""}
                            onChange={(e) => onChange({ ...data, modbusIp: e.target.value })}
                            placeholder="e.g. 192.168.1.100"
                            helperText="IP address of your PLC on the factory network"
                            fullWidth size="small" />
                        <TextField label="Port" type="number" value={data.modbusPort || 502}
                            onChange={(e) => onChange({ ...data, modbusPort: parseInt(e.target.value) })}
                            helperText="Default Modbus TCP port is 502"
                            fullWidth size="small" />
                        <TextField label="Slave ID / Unit ID" type="number" value={data.modbusSlaveId || 1}
                            onChange={(e) => onChange({ ...data, modbusSlaveId: parseInt(e.target.value) })}
                            helperText="Usually 1. Check your PLC Modbus configuration."
                            fullWidth size="small" />
                        <TextField label="Register — Run Status" type="number" value={data.modbusRegRunStatus || ""}
                            onChange={(e) => onChange({ ...data, modbusRegRunStatus: parseInt(e.target.value) })}
                            placeholder="e.g. 100"
                            helperText="Holding register address for machine run status (1=Running, 0=Stopped)"
                            fullWidth size="small" />
                        <TextField label="Register — Unit Count" type="number" value={data.modbusRegUnitCount || ""}
                            onChange={(e) => onChange({ ...data, modbusRegUnitCount: parseInt(e.target.value) })}
                            placeholder="e.g. 101"
                            helperText="Holding register address for total units produced"
                            fullWidth size="small" />
                        <TextField label="Register — Good Units" type="number" value={data.modbusRegGoodUnits || ""}
                            onChange={(e) => onChange({ ...data, modbusRegGoodUnits: parseInt(e.target.value) })}
                            placeholder="e.g. 102"
                            helperText="Holding register address for good/pass units (optional)"
                            fullWidth size="small" />
                        <TextField label="Register — Fault Status" type="number" value={data.modbusRegFaultStatus || ""}
                            onChange={(e) => onChange({ ...data, modbusRegFaultStatus: parseInt(e.target.value) })}
                            placeholder="e.g. 103"
                            helperText="Holding register address for fault/alarm code (optional)"
                            fullWidth size="small" />
                    </Box>
                </Box>
            )}
        </Box>
    );

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
                <IconButton onClick={onClose}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h5" sx={{ fontWeight: "bold" }}>
                    Admin Panel
                </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

            {/* Shift Calendar & Products Section */}
            <ShiftCalendarPanel />

            {/* Users Section */}
            <Card elevation={2} sx={{ mb: 4, borderRadius: 3 }}>
                <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: "bold" }}>User Management</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Manage login accounts — default password equals username
                            </Typography>
                        </Box>
                    </Box>
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ backgroundColor: "#1976d2" }}>
                                    <TableCell sx={{ fontWeight: "bold", color: "white" }}>Username</TableCell>
                                    <TableCell sx={{ fontWeight: "bold", color: "white" }}>Role</TableCell>
                                    <TableCell sx={{ fontWeight: "bold", color: "white" }} align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map((user, index) => (
                                    <TableRow key={user.id} hover
                                        sx={{ backgroundColor: index % 2 === 0 ? "white" : "#f9f9f9" }}>
                                        <TableCell>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <Box sx={{
                                                    width: 32, height: 32, borderRadius: "50%",
                                                    backgroundColor: user.role === "engineer" ? "#1976d2" :
                                                        user.role === "technician" ? "#ed6c02" : "#757575",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    color: "white", fontSize: 14, fontWeight: "bold"
                                                }}>
                                                    {user.username?.charAt(0).toUpperCase()}
                                                </Box>
                                                <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                                                    {user.username}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={user.role}
                                                size="small"
                                                sx={{
                                                    fontWeight: "bold",
                                                    backgroundColor: user.role === "engineer" ? "#e3f2fd" :
                                                        user.role === "technician" ? "#fff3e0" : "#f5f5f5",
                                                    color: user.role === "engineer" ? "#1976d2" :
                                                        user.role === "technician" ? "#e65100" : "#616161"
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" color="primary"
                                                onClick={() => { setEditUser(user); setNewRole(user.role); }}
                                                title="Change role">
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" color="warning"
                                                onClick={() => handleResetPassword(user)}
                                                title="Reset password to username">
                                                <LockResetIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" color="error"
                                                onClick={() => handleDeleteUser(user)}
                                                disabled={user.username === currentUsername}
                                                title="Delete user">
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {users.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} align="center" sx={{ py: 3, color: "text.secondary" }}>
                                            No users yet
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>

            <Divider sx={{ mb: 4 }} />

            {/* Machines */}
            <Card elevation={2}>
                <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: "bold" }}>Machine Management</Typography>
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowAddMachine(true)}>
                            Add Machine
                        </Button>
                    </Box>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ backgroundColor: "#f0f0f0" }}>
                                    <TableCell sx={{ fontWeight: "bold" }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Status <InfoTip title="A manually-set flag for this machine, independent of the live dashboard's data-driven status. Toggle it here to mark a machine as running or stopped." /></TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Ideal Rate <InfoTip title="The maximum units/hour this machine can produce under optimal conditions. Used to calculate Performance (Actual Rate ÷ Ideal Rate)." /></TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Connection <InfoTip title="How this machine's data gets into the dashboard: OPCUA Auto-connect (live PLC feed), CSV Import (manual/batch upload), or Modbus." /></TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Current Product <InfoTip title="Which product/SKU is running now. When set, live and CSV readings use this product's Ideal Rate instead of the machine's default — useful for multi-product lines." /></TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {machines.map((machine) => (
                                    <TableRow key={machine.id} hover>
                                        <TableCell sx={{ fontWeight: "bold" }}>{machine.name}</TableCell>
                                        <TableCell>
                                            <Chip label={machine.isRunning ? "Running" : "Stopped"}
                                                color={machine.isRunning ? "success" : "error"} size="small" />
                                        </TableCell>
                                        <TableCell>{machine.idealRate} units/hr</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={machine.connectionType || "CSV"}
                                                color={machine.connectionType === "OPCUA" ? "primary" :
                                                    machine.connectionType === "Modbus" ? "warning" : "default"}
                                                size="small"
                                            />
                                            {(machine.connectionType === "OPCUA" || machine.connectionType === "Modbus") && (
                                                <Typography variant="caption" display="block" sx={{ mt: 0.3 }}
                                                    color={machine.lastConnectionError ? "error.main" : machine.lastConnectedAt ? "success.main" : "text.secondary"}>
                                                    {machine.lastConnectionError
                                                        ? `⚠ ${machine.lastConnectionError}`
                                                        : machine.lastConnectedAt
                                                            ? `● Live · ${new Date(machine.lastConnectedAt).toLocaleTimeString()}`
                                                            : "○ Waiting for connection..."}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <FormControl size="small" sx={{ minWidth: 160 }}>
                                                <Select
                                                    value={machine.currentProductId || ""}
                                                    displayEmpty
                                                    onChange={(e) => handleProductSwitch(machine.id, e.target.value || null)}
                                                >
                                                    <MenuItem value="">— None —</MenuItem>
                                                    {products.map((p) => (
                                                        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </TableCell>
                                        <TableCell>
                                            <IconButton size="small" color="primary"
                                                onClick={() => { setEditMachineData({ ...machine }); setShowEditMachine(true); }}
                                                title="Edit machine">
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" color="error"
                                                onClick={() => handleDeleteMachine(machine)} title="Delete machine">
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>
            {/* Contacts Directory */}
            <Card elevation={2} sx={{ mt: 4 }}>
                <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                            Contact Directory (for breakdown assignments)
                        </Typography>
                        <Button variant="contained" startIcon={<AddIcon />}
                            onClick={() => setShowAddContact(true)}>
                            Add Contact
                        </Button>
                    </Box>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ backgroundColor: "#f0f0f0" }}>
                                    <TableCell sx={{ fontWeight: "bold" }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Role</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Phone</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Department</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {contacts.map((c) => (
                                    <TableRow key={c.id} hover>
                                        <TableCell sx={{ fontWeight: "bold" }}>{c.name}</TableCell>
                                        <TableCell>
                                            <Chip label={c.role}
                                                color={c.role === "Engineer" ? "primary" : "warning"}
                                                size="small" />
                                        </TableCell>
                                        <TableCell>{c.phoneNumber || "-"}</TableCell>
                                        <TableCell>{c.department || "-"}</TableCell>
                                        <TableCell>
                                            <IconButton size="small" color="error"
                                                onClick={() => handleDeleteContact(c)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {contacts.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center">
                                            No contacts yet. Add technicians and engineers here.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>

            {/* Edit Role Dialog */}
            <Dialog open={!!editUser} onClose={() => setEditUser(null)}>
                <DialogTitle>Change Role — {editUser?.username}</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth sx={{ mt: 1 }}>
                        <InputLabel>Role</InputLabel>
                        <Select value={newRole} label="Role"
                            onChange={(e) => setNewRole(e.target.value)}>
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="engineer">Engineer</MenuItem>
                            <MenuItem value="technician">Technician</MenuItem>
                            <MenuItem value="operator">Operator</MenuItem>
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditUser(null)}>Cancel</Button>
                    <Button onClick={handleUpdateRole} variant="contained">Save</Button>
                </DialogActions>
            </Dialog>
            <Dialog open={showAddContact} onClose={() => setShowAddContact(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Contact</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                        <TextField label="Full Name *" value={newContact.name}
                            onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} fullWidth />
                        <FormControl fullWidth>
                            <InputLabel>Role</InputLabel>
                            <Select value={newContact.role} label="Role"
                                onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}>
                                <MenuItem value="Technician">Technician</MenuItem>
                                <MenuItem value="Engineer">Engineer</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField label="Phone Number" value={newContact.phoneNumber}
                            onChange={(e) => setNewContact({ ...newContact, phoneNumber: e.target.value })}
                            placeholder="+60123456789" fullWidth />
                        <TextField label="Department" value={newContact.department}
                            onChange={(e) => setNewContact({ ...newContact, department: e.target.value })}
                            placeholder="e.g. Maintenance" fullWidth />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowAddContact(false)}>Cancel</Button>
                    <Button onClick={handleAddContact} variant="contained">Add Contact</Button>
                </DialogActions>
            </Dialog>

            {/* Add Machine Dialog */}
            <Dialog open={showAddMachine} onClose={() => setShowAddMachine(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add New Machine</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                        <MachineForm data={newMachine} onChange={setNewMachine} />
                        <TextField label="Machine Name" value={newMachine.name}
                            onChange={(e) => setNewMachine({ ...newMachine, name: e.target.value })}
                            fullWidth />
                        <TextField label="Ideal Rate (units/hour)" type="number"
                            value={newMachine.idealRate}
                            onChange={(e) => setNewMachine({ ...newMachine, idealRate: parseInt(e.target.value) })}
                            fullWidth />
                        <TextField label="Planned Time per Shift (minutes)" type="number"
                            value={newMachine.plannedTimeMinutes}
                            onChange={(e) => setNewMachine({ ...newMachine, plannedTimeMinutes: parseInt(e.target.value) })}
                            fullWidth />
                        <TextField label="Is Running" select value={newMachine.isRunning.toString()}
                            onChange={(e) => setNewMachine({ ...newMachine, isRunning: e.target.value === "true" })}
                            fullWidth>
                            <MenuItem value="true">Running</MenuItem>
                            <MenuItem value="false">Stopped</MenuItem>
                        </TextField>
                    </Box>

                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowAddMachine(false)}>Cancel</Button>
                    <Button onClick={handleAddMachine} variant="contained">Add Machine</Button>
                </DialogActions>
            </Dialog>
            {/* Edit Machine Dialog */}
            {editMachineData && (
                <Dialog open={showEditMachine} onClose={() => setShowEditMachine(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Edit Machine — {editMachineData.name}</DialogTitle>
                    <DialogContent>
                        <MachineForm data={editMachineData} onChange={setEditMachineData} />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowEditMachine(false)}>Cancel</Button>
                        <Button onClick={handleEditMachineSave} variant="contained">Save Changes</Button>
                    </DialogActions>
                </Dialog>
            )}
        </Box>
    );
}