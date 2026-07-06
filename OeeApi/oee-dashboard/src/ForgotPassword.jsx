import { useState } from "react";
import {
    Box, Button, Card, CardContent,
    TextField, Typography, Alert
} from "@mui/material";
import FactoryIcon from "@mui/icons-material/Factory";

export default function ForgotPassword({ onBackToLogin }) {
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSendCode = async () => {
        setError("");
        if (!email) { setError("Email is required"); return; }
        setLoading(true);
        try {
            await fetch("http://localhost:5235/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            setSuccess("If that email exists, a code has been sent. Check your inbox.");
            setStep(2);
        } catch {
            setError("Cannot connect to server");
        }
        setLoading(false);
    };

    const handleResetPassword = async () => {
        setError("");
        if (!code || !newPassword || !confirm) {
            setError("All fields are required"); return;
        }
        if (newPassword !== confirm) {
            setError("Passwords do not match"); return;
        }
        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters"); return;
        }
        setLoading(true);
        try {
            const res = await fetch("http://localhost:5235/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code, newPassword }),
            });
            if (!res.ok) {
                const msg = await res.text();
                setError(msg || "Invalid or expired code");
                setLoading(false);
                return;
            }
            setSuccess("Password reset successfully! You can now sign in.");
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
                                {step === 1 ? "Forgot Password" : step === 2 ? "Enter Code" : "Done!"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">OEE Dashboard</Typography>
                        </Box>
                    </Box>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

                    {step === 1 && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                Enter your email and we'll send you a 6-digit code to reset your password.
                            </Typography>
                            <TextField label="Email" type="email" value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                                fullWidth />
                            <Button variant="contained" size="large"
                                onClick={handleSendCode} disabled={loading} fullWidth>
                                {loading ? "Sending..." : "Send Reset Code"}
                            </Button>
                            <Button variant="text" onClick={onBackToLogin} fullWidth>
                                Back to Sign In
                            </Button>
                        </Box>
                    )}

                    {step === 2 && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                Enter the 6-digit code sent to {email} and your new password.
                            </Typography>
                            <TextField label="6-digit code" value={code}
                                onChange={(e) => setCode(e.target.value)} fullWidth />
                            <TextField label="New Password" type="password" value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)} fullWidth />
                            <TextField label="Confirm New Password" type="password" value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                                fullWidth />
                            <Button variant="contained" size="large"
                                onClick={handleResetPassword} disabled={loading} fullWidth>
                                {loading ? "Resetting..." : "Reset Password"}
                            </Button>
                            <Button variant="text" onClick={() => setStep(1)} fullWidth>
                                Resend code
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