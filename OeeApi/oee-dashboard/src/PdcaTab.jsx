import { useEffect, useState } from "react";
import {
    Box, Card, CardContent, Typography, Button,
    Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField,
    FormControl, InputLabel, Select, MenuItem,
    Chip, Alert, Stepper, Step, StepLabel, StepContent
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import API_URL from "./config";

const token = () => localStorage.getItem("oee_token");

export default function PdcaTab({ machines, userInfo }) {
    const [pdcas, setPdcas] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [selected, setSelected] = useState(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [newPdca, setNewPdca] = useState({
        machineId: "", title: "", plan: "",
        do: "", check: "", act: "", status: "Plan"
    });

    const fetchPdcas = async () => {
        const res = await fetch(`${API_URL}/pdca`, {
            headers: { Authorization: `Bearer ${token()}` }
        });
        if (res.ok) setPdcas(await res.json());
    };

    useEffect(() => { fetchPdcas(); }, []);

    const handleCreate = async () => {
        if (!newPdca.machineId || !newPdca.title) {
            setError("Machine and title are required"); return;
        }
        const res = await fetch(`${API_URL}/pdca`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
            body: JSON.stringify({
                machineId: parseInt(newPdca.machineId),
                title: newPdca.title,
                plan: newPdca.plan,
                doAction: newPdca.do,
                check: newPdca.check,
                act: newPdca.act,
                status: newPdca.status,
                createdByUserId: userInfo.userId
            })
        });
        if (res.ok) {
            setSuccess("PDCA created");
            setShowAdd(false);
            setNewPdca({ machineId: "", title: "", plan: "", do: "", check: "", act: "", status: "Plan" });
            fetchPdcas();
        } else setError("Failed to create PDCA");
    };

    const handleUpdate = async () => {
        const res = await fetch(`${API_URL}/pdca/${selected.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
            body: JSON.stringify(selected)
        });
        if (res.ok) {
            setSuccess("PDCA updated");
            setShowEdit(false);
            fetchPdcas();
        } else setError("Failed to update PDCA");
    };

    const getMachineName = (id) => machines.find(m => m.id === id)?.name || `Machine ${id}`;

    const statusColor = (s) => {
        if (s === "Plan") return "primary";
        if (s === "Do") return "warning";
        if (s === "Check") return "info";
        if (s === "Act") return "success";
        return "default";
    };

    const steps = ["Plan", "Do", "Check", "Act"];

    return (
        <Box>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    Plan → Do → Check → Act cycle for continuous improvement
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowAdd(true)}>
                    New PDCA
                </Button>
            </Box>

            <TableContainer component={Paper} elevation={2}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ backgroundColor: "#0288d1" }}>
                            {["Machine", "Title", "Status", "Plan", "Do", "Check", "Act", "Actions"].map(h => (
                                <TableCell key={h} sx={{ color: "white", fontWeight: "bold" }}>{h}</TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {pdcas.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} align="center">No PDCA cycles yet</TableCell>
                            </TableRow>
                        )}
                        {pdcas.map((p) => (
                            <TableRow key={p.id} hover>
                                <TableCell sx={{ fontWeight: "bold" }}>{getMachineName(p.machineId)}</TableCell>
                                <TableCell>{p.title}</TableCell>
                                <TableCell><Chip label={p.status} color={statusColor(p.status)} size="small" /></TableCell>
                                <TableCell sx={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {p.plan || "-"}
                                </TableCell>
                                <TableCell sx={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {p.doAction || "-"}
                                </TableCell>
                                <TableCell sx={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {p.check || "-"}
                                </TableCell>
                                <TableCell sx={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {p.act || "-"}
                                </TableCell>
                                <TableCell>
                                    <Button size="small" variant="outlined"
                                        onClick={() => { setSelected({ ...p }); setShowEdit(true); }}>
                                        Edit
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Add PDCA Dialog */}
            <Dialog open={showAdd} onClose={() => setShowAdd(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ backgroundColor: "#0288d1", color: "white" }}>
                    New PDCA Cycle
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>Machine *</InputLabel>
                            <Select value={newPdca.machineId} label="Machine *"
                                onChange={(e) => setNewPdca({ ...newPdca, machineId: e.target.value })}>
                                {machines.map(m => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <TextField label="Title *" value={newPdca.title}
                            onChange={(e) => setNewPdca({ ...newPdca, title: e.target.value })} fullWidth />
                        <Stepper orientation="vertical" activeStep={steps.indexOf(newPdca.status)}>
                            <Step>
                                <StepLabel>Plan — What do you plan to improve?</StepLabel>
                                <StepContent>
                                    <TextField multiline rows={3} fullWidth value={newPdca.plan}
                                        onChange={(e) => setNewPdca({ ...newPdca, plan: e.target.value })}
                                        placeholder="Describe the problem and planned improvement..." />
                                </StepContent>
                            </Step>
                            <Step>
                                <StepLabel>Do — What actions are being taken?</StepLabel>
                                <StepContent>
                                    <TextField multiline rows={3} fullWidth value={newPdca.do}
                                        onChange={(e) => setNewPdca({ ...newPdca, do: e.target.value })}
                                        placeholder="Describe implementation steps..." />
                                </StepContent>
                            </Step>
                            <Step>
                                <StepLabel>Check — What were the results?</StepLabel>
                                <StepContent>
                                    <TextField multiline rows={3} fullWidth value={newPdca.check}
                                        onChange={(e) => setNewPdca({ ...newPdca, check: e.target.value })}
                                        placeholder="Measure and analyze results..." />
                                </StepContent>
                            </Step>
                            <Step>
                                <StepLabel>Act — Standardize or restart cycle</StepLabel>
                                <StepContent>
                                    <TextField multiline rows={3} fullWidth value={newPdca.act}
                                        onChange={(e) => setNewPdca({ ...newPdca, act: e.target.value })}
                                        placeholder="Standardize successful changes..." />
                                </StepContent>
                            </Step>
                        </Stepper>
                        <FormControl fullWidth>
                            <InputLabel>Current Stage</InputLabel>
                            <Select value={newPdca.status} label="Current Stage"
                                onChange={(e) => setNewPdca({ ...newPdca, status: e.target.value })}>
                                <MenuItem value="Plan">Plan</MenuItem>
                                <MenuItem value="Do">Do</MenuItem>
                                <MenuItem value="Check">Check</MenuItem>
                                <MenuItem value="Act">Act</MenuItem>
                                <MenuItem value="Completed">Completed</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowAdd(false)}>Cancel</Button>
                    <Button onClick={handleCreate} variant="contained" sx={{ backgroundColor: "#0288d1" }}>
                        Create PDCA
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit PDCA Dialog */}
            {selected && (
                <Dialog open={showEdit} onClose={() => setShowEdit(false)} maxWidth="md" fullWidth>
                    <DialogTitle sx={{ backgroundColor: "#0288d1", color: "white" }}>
                        Edit PDCA — {selected.title}
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
                            <TextField label="Plan" multiline rows={3} value={selected.plan || ""}
                                onChange={(e) => setSelected({ ...selected, plan: e.target.value })} fullWidth />
                            <TextField label="Do" multiline rows={3} value={selected.doAction || ""}
                                onChange={(e) => setSelected({ ...selected, doAction: e.target.value })} fullWidth />
                            <TextField label="Check" multiline rows={3} value={selected.check || ""}
                                onChange={(e) => setSelected({ ...selected, check: e.target.value })} fullWidth />
                            <TextField label="Act" multiline rows={3} value={selected.act || ""}
                                onChange={(e) => setSelected({ ...selected, act: e.target.value })} fullWidth />
                            <FormControl fullWidth>
                                <InputLabel>Current Stage</InputLabel>
                                <Select value={selected.status} label="Current Stage"
                                    onChange={(e) => setSelected({ ...selected, status: e.target.value })}>
                                    <MenuItem value="Plan">Plan</MenuItem>
                                    <MenuItem value="Do">Do</MenuItem>
                                    <MenuItem value="Check">Check</MenuItem>
                                    <MenuItem value="Act">Act</MenuItem>
                                    <MenuItem value="Completed">Completed</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowEdit(false)}>Cancel</Button>
                        <Button onClick={handleUpdate} variant="contained" sx={{ backgroundColor: "#0288d1" }}>
                            Save
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </Box>
    );
}