import { useEffect, useState } from "react";
import {
    Box, Card, CardContent, Typography,
    FormControl, InputLabel, Select, MenuItem,
    CircularProgress, Alert, TextField, Button,
} from "@mui/material";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import API_URL from "./config";
import InfoTip from "./InfoTip";

const COLUMN_INFO = {
    Date: "The shift date this reading was recorded for.",
    Shift: "Morning (6am–6pm) or Night (6pm–6am), automatically detected from the reading's timestamp.",
    Availability: "% of planned production time the machine actually ran. Formula: Run Time ÷ Planned Time × 100.",
    Performance: "How fast the machine ran vs. its ideal rate. Formula: (Actual Output Rate ÷ Ideal Rate) × 100.",
    Quality: "% of units produced that passed quality checks. Formula: Good Units ÷ Total Units × 100.",
    OEE: "Overall Equipment Effectiveness — combines all 3 factors: Availability × Performance × Quality. 85%+ is considered world-class.",
};

// recordedAt is stored with a mislabeled UTC Kind (see backend import code),
// so parsing it with `new Date()` and converting to local time shifts the
// displayed date by the browser's UTC offset. shiftDate/shiftName were
// derived from the same raw value before that mislabeling mattered, so they
// are the correct source of truth for display.
function formatShiftDate(shiftDate) {
    if (!shiftDate) return "";
    const [y, m, d] = shiftDate.split("-");
    return `${d}/${m}/${y}`;
}

function defaultFromDate() {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
}
function todayDate() {
    return new Date().toISOString().split("T")[0];
}

export default function OeeCharts({ machines }) {
    const [selectedMachine, setSelectedMachine] = useState("");
    const [fromDate, setFromDate] = useState(defaultFromDate());
    const [toDate, setToDate] = useState(todayDate());
    const [shiftFilter, setShiftFilter] = useState("All");
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const loadHistory = () => {
        if (!selectedMachine) return;
        setLoading(true);
        setError("");
        const params = new URLSearchParams();
        if (fromDate) params.set("from", fromDate);
        if (toDate) params.set("to", toDate);
        if (shiftFilter && shiftFilter !== "All") params.set("shift", shiftFilter);

        fetch(`${API_URL}/machines/${selectedMachine}/history?${params.toString()}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("oee_token")}` }
        })
            .then((res) => res.json())
            .then((data) => {
                const formatted = data
                    .reverse()
                    .map((r) => ({
                        date: formatShiftDate(r.shiftDate),
                        shift: r.shiftName || "Day",
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
    };

    useEffect(() => {
        loadHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMachine]);

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: "bold", mb: 3 }}>
                OEE Trend Analysis
            </Typography>

            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end", mb: 3 }}>
                <FormControl sx={{ minWidth: 250 }}>
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
                <TextField
                    label="From"
                    type="date"
                    size="small"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ max: todayDate() }}
                />
                <TextField
                    label="To"
                    type="date"
                    size="small"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ max: todayDate() }}
                />
                <FormControl sx={{ minWidth: 140 }}>
                    <InputLabel>Shift</InputLabel>
                    <Select
                        value={shiftFilter}
                        label="Shift"
                        onChange={(e) => setShiftFilter(e.target.value)}
                    >
                        <MenuItem value="All">All shifts</MenuItem>
                        <MenuItem value="Morning">Morning</MenuItem>
                        <MenuItem value="Night">Night</MenuItem>
                    </Select>
                </FormControl>
                <Button variant="contained" onClick={loadHistory} disabled={!selectedMachine}>
                    Apply
                </Button>
            </Box>

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
                            <Typography variant="h6" gutterBottom>
                                Overall OEE Score
                                <InfoTip title="Your OEE trend over the selected date range. Green dashed line is the 85% world-class target; orange is the 60% warning threshold." />
                            </Typography>
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
                                <InfoTip title="Shows the 3 factors that make up OEE separately, so you can spot which one is dragging your score down." />
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
                                                <th key={h} style={{ padding: "8px 12px", textAlign: "left" }}>
                                                    {h} <InfoTip title={COLUMN_INFO[h]} iconColor="white" />
                                                </th>
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