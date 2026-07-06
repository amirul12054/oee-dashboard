import { useEffect, useState } from "react";
import {
    Box, Card, CardContent, Typography,
    FormControl, InputLabel, Select, MenuItem,
    CircularProgress, Alert
} from "@mui/material";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import API_URL from "./config";

export default function OeeCharts({ machines }) {
    const [selectedMachine, setSelectedMachine] = useState("");
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!selectedMachine) return;
        setLoading(true);
        setError("");
        fetch(`${API_URL}/machines/${selectedMachine}/history`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("oee_token")}` }
        })
            .then((res) => res.json())
            .then((data) => {
                const formatted = data
                    .reverse()
                    .map((r) => ({
                        date: new Date(r.recordedAt).toLocaleDateString("en-MY"),
                        shift: r.shift,
                        OEE: parseFloat(r.oeeScore),
                        Availability: parseFloat(r.availability),
                        Performance: parseFloat(r.performance),
                        Quality: parseFloat(r.quality),
                    }));
                setHistory(formatted);
                setLoading(false);
            })
            .catch(() => {
                setError("Failed to load history");
                setLoading(false);
            });
    }, [selectedMachine]);

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: "bold", mb: 3 }}>
                OEE Trend Analysis
            </Typography>

            <FormControl sx={{ minWidth: 250, mb: 3 }}>
                <InputLabel>Select Machine</InputLabel>
                <Select
                    value={selectedMachine}
                    label="Select Machine"
                    onChange={(e) => setSelectedMachine(e.target.value)}
                >
                    {machines.map((m) => (
                        <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                    ))}
                </Select>
            </FormControl>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {!loading && selectedMachine && history.length === 0 && (
                <Alert severity="info">
                    No history data found for this machine. Import a CSV file to see trends.
                </Alert>
            )}

            {!loading && history.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

                    {/* OEE Score Chart */}
                    <Card elevation={2}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>Overall OEE Score</Typography>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={history}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(val) => `${val.toFixed(1)}%`} />
                                    <Legend />
                                    <ReferenceLine y={85} stroke="green"
                                        strokeDasharray="5 5" label={{ value: "Target 85%", fill: "green", fontSize: 12 }} />
                                    <ReferenceLine y={60} stroke="orange"
                                        strokeDasharray="5 5" label={{ value: "Warning 60%", fill: "orange", fontSize: 12 }} />
                                    <Line type="monotone" dataKey="OEE" stroke="#1976d2"
                                        strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Availability Performance Quality Chart */}
                    <Card elevation={2}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Availability / Performance / Quality Breakdown
                            </Typography>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={history}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(val) => `${val.toFixed(1)}%`} />
                                    <Legend />
                                    <Line type="monotone" dataKey="Availability"
                                        stroke="#2e7d32" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="Performance"
                                        stroke="#ed6c02" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="Quality"
                                        stroke="#9c27b0" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Shift breakdown table */}
                    <Card elevation={2}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>Recent Readings</Typography>
                            <Box sx={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ backgroundColor: "#1976d2", color: "white" }}>
                                            {["Date", "Shift", "Availability", "Performance", "Quality", "OEE"].map(h => (
                                                <th key={h} style={{ padding: "8px 12px", textAlign: "left" }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((row, i) => (
                                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#f5f5f5" : "white" }}>
                                                <td style={{ padding: "8px 12px" }}>{row.date}</td>
                                                <td style={{ padding: "8px 12px" }}>{row.shift}</td>
                                                <td style={{ padding: "8px 12px", color: row.Availability >= 85 ? "#2e7d32" : row.Availability >= 60 ? "#ed6c02" : "#d32f2f" }}>
                                                    {row.Availability.toFixed(1)}%
                                                </td>
                                                <td style={{ padding: "8px 12px", color: row.Performance >= 85 ? "#2e7d32" : row.Performance >= 60 ? "#ed6c02" : "#d32f2f" }}>
                                                    {row.Performance.toFixed(1)}%
                                                </td>
                                                <td style={{ padding: "8px 12px", color: row.Quality >= 85 ? "#2e7d32" : row.Quality >= 60 ? "#ed6c02" : "#d32f2f" }}>
                                                    {row.Quality.toFixed(1)}%
                                                </td>
                                                <td style={{ padding: "8px 12px", fontWeight: "bold", color: row.OEE >= 85 ? "#2e7d32" : row.OEE >= 60 ? "#ed6c02" : "#d32f2f" }}>
                                                    {row.OEE.toFixed(1)}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </Box>
                        </CardContent>
                    </Card>
                </Box>
            )}
        </Box>
    );
}