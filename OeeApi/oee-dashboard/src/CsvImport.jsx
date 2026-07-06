import { useState } from "react";
import {
    Box, Button, Card, CardContent, Typography,
    Alert, Select, MenuItem, FormControl, InputLabel,
    Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, Stepper, Step,
    StepLabel, Chip
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import API_URL from "./config";

const OEE_FIELDS = [
    { key: "colDate", label: "Date/Time", required: true },
    { key: "colPlanned", label: "Planned Time (minutes)", required: true },
    { key: "colRunTime", label: "Run Time (minutes)", required: true },
    { key: "colIdealRate", label: "Ideal Rate (units/hour)", required: true },
    { key: "colActualRate", label: "Actual Rate (units/hour)", required: true },
    { key: "colTotalUnits", label: "Total Units Produced", required: true },
    { key: "colGoodUnits", label: "Good Units", required: true },
];

export default function CsvImport({ onClose }) {
    const [step, setStep] = useState(0);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [mapping, setMapping] = useState({});
    const [machineId, setMachineId] = useState("");
    const [shift, setShift] = useState("Morning");
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setError("");
    };

    const handleUploadPreview = async () => {
        if (!file) { setError("Please select a CSV file"); return; }
        setLoading(true);
        setError("");
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch(`${API_URL}/import/preview`, {
                method: "POST",
                headers: { Authorization: `Bearer ${localStorage.getItem("oee_token")}` },
                body: formData,
            });
            if (!res.ok) { setError("Failed to read file"); setLoading(false); return; }
            const data = await res.json();
            setPreview(data);
            setStep(1);
        } catch {
            setError("Cannot connect to server");
        }
        setLoading(false);
    };

    const handleMappingChange = (field, colIndex) => {
        setMapping((prev) => ({ ...prev, [field]: colIndex }));
    };

    const handleProcess = async () => {
        setError("");
        if (!machineId) { setError("Please select a machine"); return; }
        const missingFields = OEE_FIELDS.filter(f => f.required && mapping[f.key] === undefined);
        if (missingFields.length > 0) {
            setError(`Please map these fields: ${missingFields.map(f => f.label).join(", ")}`);
            return;
        }
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("machineId", machineId);
            formData.append("shift", shift);
            Object.entries(mapping).forEach(([key, val]) => {
                formData.append(key, val.toString());
            });
            const res = await fetch(`${API_URL}/import/process`, {
                method: "POST",
                headers: { Authorization: `Bearer ${localStorage.getItem("oee_token")}` },
                body: formData,
            });
            if (!res.ok) { setError("Import failed"); setLoading(false); return; }
            const data = await res.json();
            setResult(data);
            setStep(2);
        } catch {
            setError("Cannot connect to server");
        }
        setLoading(false);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: "bold", mb: 3 }}>
                CSV Data Import
            </Typography>

            <Stepper activeStep={step} sx={{ mb: 4 }}>
                <Step><StepLabel>Upload File</StepLabel></Step>
                <Step><StepLabel>Map Columns</StepLabel></Step>
                <Step><StepLabel>Done</StepLabel></Step>
            </Stepper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Step 1 - Upload */}
            {step === 0 && (
                <Card elevation={2}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>Select your CSV file</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Upload any CSV file exported from your machine. We'll detect the columns automatically.
                        </Typography>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
                            <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} size="large">
                                Choose CSV File
                                <input type="file" accept=".csv" hidden onChange={handleFileChange} />
                            </Button>
                            {file && (
                                <Chip label={file.name} color="primary" variant="outlined" />
                            )}
                            <Button variant="contained" onClick={handleUploadPreview}
                                disabled={!file || loading} size="large">
                                {loading ? "Reading file..." : "Upload & Preview"}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* Step 2 - Map Columns */}
            {step === 1 && preview && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

                    {/* Data preview */}
                    <Card elevation={2}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                File Preview — {preview.headers.length} columns detected
                            </Typography>
                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: "#f0f0f0" }}>
                                            <TableCell sx={{ fontWeight: "bold" }}>Col #</TableCell>
                                            {preview.headers.map((h, i) => (
                                                <TableCell key={i} sx={{ fontWeight: "bold" }}>{h}</TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {preview.previewRows.map((row, ri) => (
                                            <TableRow key={ri}>
                                                <TableCell color="text.secondary">{ri + 1}</TableCell>
                                                {row.map((val, ci) => (
                                                    <TableCell key={ci}>{val}</TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>

                    {/* Machine + Shift selection */}
                    <Card elevation={2}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>Import Settings</Typography>
                            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                                <FormControl sx={{ minWidth: 200 }}>
                                    <InputLabel>Machine</InputLabel>
                                    <Select value={machineId} label="Machine"
                                        onChange={(e) => setMachineId(e.target.value)}>
                                        {preview.machines.map((m) => (
                                            <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <FormControl sx={{ minWidth: 200 }}>
                                    <InputLabel>Shift</InputLabel>
                                    <Select value={shift} label="Shift"
                                        onChange={(e) => setShift(e.target.value)}>
                                        <MenuItem value="Morning">Morning</MenuItem>
                                        <MenuItem value="Afternoon">Afternoon</MenuItem>
                                        <MenuItem value="Night">Night</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Column mapping */}
                    <Card elevation={2}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>Map Your Columns</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Tell us which column in your CSV matches each OEE field.
                            </Typography>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                {OEE_FIELDS.map((field) => (
                                    <Box key={field.key} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                        <Typography sx={{ minWidth: 220 }}>
                                            {field.label}
                                            {field.required && <span style={{ color: "red" }}> *</span>}
                                        </Typography>
                                        <FormControl sx={{ minWidth: 220 }}>
                                            <InputLabel>Select column</InputLabel>
                                            <Select
                                                value={mapping[field.key] ?? ""}
                                                label="Select column"
                                                onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                            >
                                                {preview.headers.map((h, i) => (
                                                    <MenuItem key={i} value={i}>{h}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Box>
                                ))}
                            </Box>
                        </CardContent>
                    </Card>

                    <Box sx={{ display: "flex", gap: 2 }}>
                        <Button variant="outlined" onClick={() => setStep(0)}>Back</Button>
                        <Button variant="contained" onClick={handleProcess} disabled={loading} size="large">
                            {loading ? "Importing..." : "Import Data"}
                        </Button>
                    </Box>
                </Box>
            )}

            {/* Step 3 - Done */}
            {step === 2 && result && (
                <Card elevation={2}>
                    <CardContent>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                            <CheckCircleIcon sx={{ fontSize: 48, color: "green" }} />
                            <Box>
                                <Typography variant="h5" sx={{ fontWeight: "bold", color: "green" }}>
                                    Import Successful!
                                </Typography>
                                <Typography variant="body1">
                                    {result.imported} rows imported successfully
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
                            <Button variant="contained" onClick={onClose}>
                                Back to Dashboard
                            </Button>
                            <Button variant="outlined" onClick={() => {
                                setStep(0); setFile(null); setPreview(null);
                                setMapping({}); setResult(null);
                            }}>
                                Import Another File
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}