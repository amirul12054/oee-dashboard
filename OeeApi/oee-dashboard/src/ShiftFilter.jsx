import { useState, useEffect, useCallback } from "react";
import {
    Box, Card, CardContent, Typography, FormControl,
    InputLabel, Select, MenuItem, TextField, Button,
    Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, Chip, Alert, CircularProgress
} from "@mui/material";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import API_URL from "./config";


const token = () => localStorage.getItem("oee_token");

export default function ShiftFilter({ machines }) {
    const [selectedDate, setSelectedDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [selectedShift, setSelectedShift] = useState("Morning");
    const [selectedMachine, setSelectedMachine] = useState("all");
    const [readings, setReadings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");




    const fetchReadings = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            let url = `${API_URL}/oee-readings?date=${selectedDate}&shift=${selectedShift}`;

            if (selectedMachine !== "all") {
                url += `&machineId=${selectedMachine}`;
            }

            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token()}`
                }
            });

            if (!res.ok) throw new Error();

            const data = await res.json();

            setReadings(Array.isArray(data) ? data : []);
        } catch {
            setError("Failed to load shift data");
        }

        setLoading(false);
    }, [selectedDate, selectedShift, selectedMachine]);

    useEffect(() => {
        fetchReadings();
    }, [fetchReadings]);

    const getMachineName = (id) =>
        machines.find(m => m.id === id)?.name || `Machine ${id}`;

    const getShiftTime = (shift) =>
        shift === "Morning" ? "06:00 AM — 06:00 PM" : "06:00 PM — 06:00 AM";

    const avgOEE = readings.length > 0
        ? readings.reduce((sum, r) => sum + parseFloat(r.oeeScore), 0) / readings.length
        : 0;

    const getOEEColor = (oee) =>
        oee >= 85 ? "#2e7d32" : oee >= 60 ? "#ed6c02" : "#d32f2f";

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: "bold", mb: 3 }}>
                Shift OEE Report
            </Typography>

            {/* Filter Controls */}
            <Card elevation={2} sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end" }}>
                        <TextField
                            label="Date"
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            sx={{ minWidth: 180 }}
                        />
                        <FormControl sx={{ minWidth: 180 }}>
                            <InputLabel>Shift</InputLabel>
                            <Select value={selectedShift} label="Shift"
                                onChange={(e) => setSelectedShift(e.target.value)}>
                                <MenuItem value="All">All Shifts</MenuItem>
                                <MenuItem value="Morning">🌅 Morning (6AM - 6PM)</MenuItem>
                                <MenuItem value="Night">🌙 Night (6PM - 6AM)</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl sx={{ minWidth: 180 }}>
                            <InputLabel>Machine</InputLabel>
                            <Select value={selectedMachine} label="Machine"
                                onChange={(e) => setSelectedMachine(e.target.value)}>
                                <MenuItem value="all">All Machines</MenuItem>
                                {machines.map(m => (
                                    <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button variant="contained" onClick={fetchReadings} disabled={loading}>
                            {loading ? "Loading..." : "View Report"}
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {!loading && readings.length === 0 && (
                <Alert severity="info">
                    No data found for {selectedDate} — {selectedShift} shift.
                    Import a CSV file to see shift data here.
                </Alert>
            )}

            {!loading && readings.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

                    {/* Summary */}
                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                        <Card elevation={2} sx={{ flex: 1, minWidth: 150 }}>
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">
                                    Date
                                </Typography>
                                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                                    {selectedDate}
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card elevation={2} sx={{ flex: 1, minWidth: 150 }}>
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">
                                    Shift
                                </Typography>
                                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                                    {selectedShift === "All" ? "All Shifts" : `${selectedShift} Shift`}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {selectedShift !== "All" && getShiftTime(selectedShift)}
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card elevation={2} sx={{ flex: 1, minWidth: 150 }}>
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">
                                    Average OEE
                                </Typography>
                                <Typography variant="h4" sx={{
                                    fontWeight: "bold",
                                    color: getOEEColor(avgOEE)
                                }}>
                                    {avgOEE.toFixed(1)}%
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card elevation={2} sx={{ flex: 1, minWidth: 150 }}>
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">
                                    Total Records
                                </Typography>
                                <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                                    {readings.length}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>

                    {/* OEE Trend Chart */}
                    <Card elevation={2}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>OEE Trend</Typography>
                            <ResponsiveContainer width="100%" height={280}>
                                <LineChart data={readings.map(r => ({
                                    time: new Date(r.recordedAt).toLocaleTimeString("en-MY",
                                        { hour: "2-digit", minute: "2-digit" }),
                                    OEE: parseFloat(r.oeeScore),
                                    Availability: parseFloat(r.availability),
                                    Performance: parseFloat(r.performance),
                                    Quality: parseFloat(r.quality),
                                }))}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                                    <Tooltip formatter={(v) => `${parseFloat(v).toFixed(1)}%`} />
                                    <Legend />
                                    <ReferenceLine y={85} stroke="green" strokeDasharray="5 5"
                                        label={{ value: "Target 85%", fill: "green", fontSize: 11 }} />
                                    <Line type="monotone" dataKey="OEE" stroke="#1976d2" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="Availability" stroke="#2e7d32" strokeWidth={1} dot={false} />
                                    <Line type="monotone" dataKey="Performance" stroke="#ed6c02" strokeWidth={1} dot={false} />
                                    <Line type="monotone" dataKey="Quality" stroke="#9c27b0" strokeWidth={1} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Detailed Table */}
                    <Card elevation={2}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>Detailed Readings</Typography>
                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: "#1976d2" }}>
                                            {["Time", "Machine", "Shift", "Availability", "Performance", "Quality", "OEE", "Units", "Good Units"].map(h => (
                                                <TableCell key={h} sx={{ color: "white", fontWeight: "bold", fontSize: 11 }}>
                                                    {h}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {readings.map((r, i) => (
                                            <TableRow key={r.id} hover
                                                sx={{ backgroundColor: i % 2 === 0 ? "white" : "#f9f9f9" }}>
                                                <TableCell sx={{ fontSize: 11 }}>
                                                    {new Date(r.recordedAt).toLocaleTimeString("en-MY",
                                                        { hour: "2-digit", minute: "2-digit" })}
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: "bold", fontSize: 11 }}>
                                                    {getMachineName(r.machineId)}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={r.shiftName || r.shift}
                                                        size="small"
                                                        color={r.shiftName === "Morning" ? "warning" : "primary"}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip label={`${parseFloat(r.availability).toFixed(1)}%`}
                                                        size="small" variant="outlined"
                                                        color={r.availability >= 85 ? "success" : r.availability >= 60 ? "warning" : "error"} />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip label={`${parseFloat(r.performance).toFixed(1)}%`}
                                                        size="small" variant="outlined"
                                                        color={r.performance >= 85 ? "success" : r.performance >= 60 ? "warning" : "error"} />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip label={`${parseFloat(r.quality).toFixed(1)}%`}
                                                        size="small" variant="outlined"
                                                        color={r.quality >= 85 ? "success" : r.quality >= 60 ? "warning" : "error"} />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography sx={{
                                                        fontWeight: "bold",
                                                        color: getOEEColor(parseFloat(r.oeeScore)),
                                                        fontSize: 13
                                                    }}>
                                                        {parseFloat(r.oeeScore).toFixed(1)}%
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: 11 }}>{r.totalUnits}</TableCell>
                                                <TableCell sx={{ fontSize: 11 }}>{r.goodUnits}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Box>
            )}
        </Box>
    );
}