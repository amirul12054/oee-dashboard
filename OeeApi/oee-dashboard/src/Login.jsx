import { useState } from "react";
import {
    Box, Button, Card, CardContent,
    TextField, Typography, Alert, Divider
} from "@mui/material";
import FactoryIcon from "@mui/icons-material/Factory";
import API_URL from "./config";

export default function Login({ onLogin, onRegister, onForgotPassword }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            if (!res.ok) {
                setError("Invalid email or password");
                setLoading(false);
                return;
            }
            const data = await res.json();
            onLogin(data.token);
        } catch {
            setError("Cannot connect to server");
            setLoading(false);
        }
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
                            <Typography variant="h5" sx={{ fontWeight: "bold" }}>OEE Dashboard</Typography>
                            <Typography variant="body2" color="text.secondary">Sign in to continue</Typography>
                        </Box>
                    </Box>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <TextField label="Email" type="email" value={email}
                            onChange={(e) => setEmail(e.target.value)} fullWidth />
                        <TextField label="Password" type="password" value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                            fullWidth />
                        <Button variant="text" size="small"
                            onClick={onForgotPassword}
                            sx={{ alignSelf: "flex-end", mt: -1 }}>
                            Forgot password?
                        </Button>
                        <Button variant="contained" size="large"
                            onClick={handleLogin} disabled={loading} fullWidth>
                            {loading ? "Signing in..." : "Sign In"}
                        </Button>
                        <Divider />
                        <Button variant="outlined" onClick={onRegister} fullWidth>
                            Create new account
                        </Button>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}