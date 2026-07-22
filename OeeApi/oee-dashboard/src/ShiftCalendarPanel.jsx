import { useEffect, useState } from "react";
import {
    Box, Card, CardContent, Typography, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Button, TextField, IconButton,
    Alert, Grid,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import InfoTip from "./InfoTip";
import API_URL from "./config";

function authHeaders() {
    return { Authorization: `Bearer ${localStorage.getItem("oee_token")}` };
}

export default function ShiftCalendarPanel() {
    const [shifts, setShifts] = useState([]);
    const [holidays, setHolidays] = useState([]);
    const [products, setProducts] = useState([]);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [newShift, setNewShift] = useState({ name: "", startTime: "06:00", endTime: "18:00" });
    const [newHoliday, setNewHoliday] = useState({ date: "", reason: "" });
    const [newProduct, setNewProduct] = useState({ sku: "", name: "", idealRate: 0 });

    const fetchAll = async () => {
        try {
            const [sRes, hRes, pRes] = await Promise.all([
                fetch(`${API_URL}/shifts`, { headers: authHeaders() }),
                fetch(`${API_URL}/holidays`, { headers: authHeaders() }),
                fetch(`${API_URL}/products`, { headers: authHeaders() }),
            ]);
            setShifts(sRes.ok ? await sRes.json() : []);
            setHolidays(hRes.ok ? await hRes.json() : []);
            setProducts(pRes.ok ? await pRes.json() : []);
        } catch {
            setError("Failed to load shift/calendar settings");
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const addShift = async () => {
        if (!newShift.name) { setError("Shift name is required"); return; }
        const res = await fetch(`${API_URL}/admin/shifts`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({
                name: newShift.name,
                startTime: newShift.startTime + ":00",
                endTime: newShift.endTime + ":00",
                isActive: true,
                sortOrder: shifts.length,
            }),
        });
        if (res.ok) {
            setSuccess(`Shift "${newShift.name}" added`);
            setNewShift({ name: "", startTime: "06:00", endTime: "18:00" });
            fetchAll();
        } else setError("Failed to add shift");
    };

    const deleteShift = async (id) => {
        if (!window.confirm("Delete this shift pattern?")) return;
        const res = await fetch(`${API_URL}/admin/shifts/${id}`, { method: "DELETE", headers: authHeaders() });
        if (res.ok) { setSuccess("Shift deleted"); fetchAll(); }
        else setError("Failed to delete shift");
    };

    const addHoliday = async () => {
        if (!newHoliday.date) { setError("Date is required"); return; }
        const res = await fetch(`${API_URL}/admin/holidays`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ date: newHoliday.date, reason: newHoliday.reason, machineId: null }),
        });
        if (res.ok) {
            setSuccess("Holiday added");
            setNewHoliday({ date: "", reason: "" });
            fetchAll();
        } else setError("Failed to add holiday");
    };

    const deleteHoliday = async (id) => {
        const res = await fetch(`${API_URL}/admin/holidays/${id}`, { method: "DELETE", headers: authHeaders() });
        if (res.ok) { setSuccess("Holiday removed"); fetchAll(); }
        else setError("Failed to delete holiday");
    };

    const addProduct = async () => {
        if (!newProduct.name) { setError("Product name is required"); return; }
        const res = await fetch(`${API_URL}/admin/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({
                sku: newProduct.sku, name: newProduct.name,
                idealRate: parseInt(newProduct.idealRate) || 0, isActive: true,
            }),
        });
        if (res.ok) {
            setSuccess(`Product "${newProduct.name}" added`);
            setNewProduct({ sku: "", name: "", idealRate: 0 });
            fetchAll();
        } else setError("Failed to add product");
    };

    const deleteProduct = async (id) => {
        if (!window.confirm("Delete this product?")) return;
        const res = await fetch(`${API_URL}/admin/products/${id}`, { method: "DELETE", headers: authHeaders() });
        if (res.ok) { setSuccess("Product deleted"); fetchAll(); }
        else setError("Failed to delete product");
    };

    return (
        <Box>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}

            {/* Shift Patterns */}
            <Card elevation={2} sx={{ mb: 4, borderRadius: 3 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
                        Shift Patterns
                        <InfoTip title="Defines when each shift starts/ends. Replaces the old fixed 6am-6pm Morning/Night split — readings are automatically labeled with whichever shift their timestamp falls into. Supports overnight shifts (e.g. 18:00 → 06:00)." />
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        If no shifts are defined, the system falls back to the default 6am-6pm Morning/Night split.
                    </Typography>
                    <TableContainer sx={{ mb: 2 }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: "bold" }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Start</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>End</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {shifts.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell>{s.name}</TableCell>
                                        <TableCell>{s.startTime}</TableCell>
                                        <TableCell>{s.endTime}</TableCell>
                                        <TableCell>
                                            <IconButton size="small" color="error" onClick={() => deleteShift(s.id)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {shifts.length === 0 && (
                                    <TableRow><TableCell colSpan={4}>
                                        <Typography variant="body2" color="text.secondary">No custom shifts configured — using default 6am-6pm Morning/Night.</Typography>
                                    </TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Grid container spacing={1.5} alignItems="center">
                        <Grid size={{ xs: 12, sm: 3 }}>
                            <TextField label="Name" size="small" fullWidth value={newShift.name}
                                onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                                placeholder="e.g. Afternoon" />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <TextField label="Start" type="time" size="small" fullWidth value={newShift.startTime}
                                onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                                InputLabelProps={{ shrink: true }} />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <TextField label="End" type="time" size="small" fullWidth value={newShift.endTime}
                                onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                                InputLabelProps={{ shrink: true }} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3 }}>
                            <Button variant="contained" startIcon={<AddIcon />} fullWidth onClick={addShift}>
                                Add Shift
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Holidays */}
            <Card elevation={2} sx={{ mb: 4, borderRadius: 3 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
                        Holidays & Planned Off-Days
                        <InfoTip title="Dates the factory is scheduled to be off. Machines will show a 'Holiday' status instead of 'No Data'/'Down' on these dates." />
                    </Typography>
                    <TableContainer sx={{ mb: 2 }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: "bold" }}>Date</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Reason</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {holidays.map((h) => (
                                    <TableRow key={h.id}>
                                        <TableCell>{h.date}</TableCell>
                                        <TableCell>{h.reason}</TableCell>
                                        <TableCell>
                                            <IconButton size="small" color="error" onClick={() => deleteHoliday(h.id)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {holidays.length === 0 && (
                                    <TableRow><TableCell colSpan={3}>
                                        <Typography variant="body2" color="text.secondary">No holidays configured yet.</Typography>
                                    </TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Grid container spacing={1.5} alignItems="center">
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField label="Date" type="date" size="small" fullWidth value={newHoliday.date}
                                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                                InputLabelProps={{ shrink: true }} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 5 }}>
                            <TextField label="Reason" size="small" fullWidth value={newHoliday.reason}
                                onChange={(e) => setNewHoliday({ ...newHoliday, reason: e.target.value })}
                                placeholder="e.g. Hari Raya, Planned shutdown" />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3 }}>
                            <Button variant="contained" startIcon={<AddIcon />} fullWidth onClick={addHoliday}>
                                Add Holiday
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Products */}
            <Card elevation={2} sx={{ mb: 4, borderRadius: 3 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
                        Products / SKUs
                        <InfoTip title="Each product can have its own Ideal Rate. Set a machine's 'Current Product' (in Machine Management) and live OPC-UA/Modbus readings will use this product's Ideal Rate for Performance instead of the machine's default. CSV imports are unaffected — each row's own Ideal Rate column always wins." />
                    </Typography>
                    <TableContainer sx={{ mb: 2 }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: "bold" }}>SKU</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}>Ideal Rate</TableCell>
                                    <TableCell sx={{ fontWeight: "bold" }}></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {products.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell>{p.sku}</TableCell>
                                        <TableCell>{p.name}</TableCell>
                                        <TableCell>{p.idealRate} units/hr</TableCell>
                                        <TableCell>
                                            <IconButton size="small" color="error" onClick={() => deleteProduct(p.id)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {products.length === 0 && (
                                    <TableRow><TableCell colSpan={4}>
                                        <Typography variant="body2" color="text.secondary">No products configured yet.</Typography>
                                    </TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Grid container spacing={1.5} alignItems="center">
                        <Grid size={{ xs: 12, sm: 3 }}>
                            <TextField label="SKU" size="small" fullWidth value={newProduct.sku}
                                onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField label="Name" size="small" fullWidth value={newProduct.name}
                                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 2 }}>
                            <TextField label="Ideal Rate" type="number" size="small" fullWidth value={newProduct.idealRate}
                                onChange={(e) => setNewProduct({ ...newProduct, idealRate: e.target.value })} />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Button variant="contained" startIcon={<AddIcon />} fullWidth onClick={addProduct}>
                                Add Product
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
        </Box>
    );
}
