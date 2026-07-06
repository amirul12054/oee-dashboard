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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const API = "http://localhost:5235";
const token = () => localStorage.getItem("oee_token");

export default function AdminPanel({ onClose, currentUserEmail }) {
    const [users, setUsers] = useState([]);
    const [machines, setMachines] = useState([]);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Add machine dialog
    const [showAddMachine, setShowAddMachine] = useState(false);
    const [newMachine, setNewMachine] = useState({
        name: "", isRunning: false, unitsProduced: 0,
        goodUnits: 0, plannedTimeMinutes: 480,
        runTimeMinutes: 0, idealRate: 0, actualRate: 0
    });

    // Edit role dialog
    const [editUser, setEditUser] = useState(null);
    const [newRole, setNewRole] = useState("");

    const fetchUsers = () => {
        fetch(`${API}/admin/users`, {
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

    useEffect(() => {
        fetchUsers();
        fetchMachines();
    }, []);

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
        if (user.email === currentUserEmail) {
            setError("You cannot delete your own account");
            return;
        }
        if (!window.confirm(`Delete user ${user.email}?`)) return;
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

    const handleAddMachine = async () => {
        if (!newMachine.name) { setError("Machine name is required"); return; }
        const res = await fetch(`${API}/admin/machines`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token()}`
            },
            body: JSON.stringify(newMachine)
        });
        if (res.ok) {
            setSuccess(`Machine ${newMachine.name} added`);
            setShowAddMachine(false);
            setNewMachine({
                name: "", isRunning: false, unitsProduced: 0,
                goodUnits: 0, plannedTimeMinutes: 480,
                runTimeMinutes: 0, idealRate: 0, actualRate: 0
            });
            fetchMachines();
        } else {
            setError("Failed to add machine");
        }
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
            setError("Failed to delete machine");
        }
    };

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

            {/* Users Section */}
            <Card elevation={2} sx={{ mb: 4 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>
                        User Management
                    </Typography>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ backgroundColor: "#f0f0f0" }}>
                                    <TableCell sx={{ fontWeight: "bold" }}>Email</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Role</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id} hover>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={user.role}
                                                color={user.role === "admin" ? "primary" : "default"}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <IconButton size="small" color="primary"
                                                onClick={() => { setEditUser(user); setNewRole(user.role); }}
                                                title="Change role">
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" color="error"
                                                onClick={() => handleDeleteUser(user)}
                                                disabled={user.email === currentUserEmail}
                                                title="Delete user">
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

            <Divider sx={{ mb: 4 }} />

            {/* Machines Section */}
            <Card elevation={2}>
                <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                            Machine Management
                        </Typography>
                        <Button variant="contained" startIcon={<AddIcon />}
                            onClick={() => setShowAddMachine(true)}>
                            Add Machine
                        </Button>
                    </Box>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ backgroundColor: "#f0f0f0" }}>
                                    <TableCell sx={{ fontWeight: "bold" }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Ideal Rate</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {machines.map((machine) => (
                                    <TableRow key={machine.id} hover>
                                        <TableCell sx={{ fontWeight: "bold" }}>{machine.name}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={machine.isRunning ? "Running" : "Stopped"}
                                                color={machine.isRunning ? "success" : "error"}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>{machine.idealRate} units/hr</TableCell>
                                        <TableCell>
                                            <IconButton size="small" color="error"
                                                onClick={() => handleDeleteMachine(machine)}
                                                title="Delete machine">
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

            {/* Edit Role Dialog */}
            <Dialog open={!!editUser} onClose={() => setEditUser(null)}>
                <DialogTitle>Change Role — {editUser?.email}</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth sx={{ mt: 1 }}>
                        <InputLabel>Role</InputLabel>
                        <Select value={newRole} label="Role"
                            onChange={(e) => setNewRole(e.target.value)}>
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="operator">Operator</MenuItem>
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditUser(null)}>Cancel</Button>
                    <Button onClick={handleUpdateRole} variant="contained">Save</Button>
                </DialogActions>
            </Dialog>

            {/* Add Machine Dialog */}
            <Dialog open={showAddMachine} onClose={() => setShowAddMachine(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add New Machine</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
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
        </Box>
    );
}