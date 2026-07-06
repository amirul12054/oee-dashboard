import { useState } from "react";
import {
    Box, Button, Card, CardContent,
    TextField, Typography, Alert
} from "@mui/material";
import FactoryIcon from "@mui/icons-material/Factory";

export default function Register({ onBackToLogin }) {
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSendCode = async () => {
        setError("");
        if (!email) { setError("Email is required"); return; }
        setLoading(true);
        try {
            const res = await fetch("http://localhost:5235/auth/send-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, type: "register" }),
            });
            if (!res.ok) {
                setError("Failed to send code. Email may already be registered.");
                setLoading(false);
                return;
            }
            setSuccess(`Verification code sent to ${email}. Check your inbox.`);
            setStep(2);
        } catch {
            setError("Cannot connect to server");
        }
        setLoading(false);
    };

    const handleVerifyAndRegister = async () => {
        setError("");
        if (!code || !password || !confirm) {
            setError("All fields are required"); return;
        }
        if (password !== confirm) {
            setError("Passwords do not match"); return;
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters"); return;
        }
        setLoading(true);
        try {
            const res = await fetch("http://localhost:5235/auth/verify-register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code, password }),
            });
            if (!res.ok) {
                const msg = await res.text();
                setError(msg || "Invalid or expired code");
                setLoading(false);
                return;
            }
            setSuccess("Account created successfully! You can now sign in.");
            setStep(3);
        } catch {
            setError("Cannot connect to server");
        }
        setLoading(false);
    };

    return (
        <Box sx={{
            minHeight: "100vh", backgroundColor: "#f5f5f5",
            display: "flex", alignItems: "center", justifyContent: "center"
        }}>
            <Card elevation={4} sx={{ width: 400, p: 2 }}>
                <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                        <FactoryIcon sx={{ fontSize: 40, color: "#1976d2" }} />
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: "bold" }}>
                                {step === 1 ? "Create Account" : step === 2 ? "Verify Email" : "Welcome!"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">OEE Dashboard</Typography>
                        </Box>
                    </Box>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

                    {step === 1 && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                Enter your email and we'll send you a verification code.
                            </Typography>
                            <TextField label="Email" type="email" value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                                fullWidth />
                            <Button variant="contained" size="large"
                                onClick={handleSendCode} disabled={loading} fullWidth>
                                {loading ? "Sending code..." : "Send Verification Code"}
                            </Button>
                            <Button variant="text" onClick={onBackToLogin} fullWidth>
                                Already have an account? Sign in
                            </Button>
                        </Box>
                    )}

                    {step === 2 && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                Enter the 6-digit code sent to {email}, then set your password.
                            </Typography>
                            <TextField label="6-digit verification code" value={code}
                                onChange={(e) => setCode(e.target.value)} fullWidth />
                            <TextField label="Password" type="password" value={password}
                                onChange={(e) => setPassword(e.target.value)} fullWidth />
                            <TextField label="Confirm Password" type="password" value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleVerifyAndRegister()}
                                fullWidth />
                            <Button variant="contained" size="large"
                                onClick={handleVerifyAndRegister} disabled={loading} fullWidth>
                                {loading ? "Creating account..." : "Verify & Create Account"}
                            </Button>
                            <Button variant="text" onClick={() => { setStep(1); setSuccess(""); }} fullWidth>
                                Use different email
                            </Button>
                        </Box>
                    )}

                    {step === 3 && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <Button variant="contained" size="large"
                                onClick={onBackToLogin} fullWidth>
                                Go to Sign In
                            </Button>
                        </Box>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}