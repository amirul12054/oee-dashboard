import { useEffect, useState } from "react";
import {
    Box, Card, CardContent, Typography, Button,
    TextField, Alert, IconButton
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import API_URL from "./config";
import { useMemo } from "react";

const token = () => localStorage.getItem("oee_token");

function parseToken(t) {
    try {
        const base64 = t.split(".")[1];
        const decoded = JSON.parse(atob(base64));
        return {
            userId: parseInt(decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"]),
            email: decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
            role: decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]
        };
    } catch { return { userId: 0, email: "", role: "" }; }
}

export default function ProfilePage({ onClose }) {
    const userInfo = useMemo(() => parseToken(token()), []);
    const [phone, setPhone] = useState("");
    const [department, setDepartment] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        fetch(`${API_URL}/users`, {
            headers: {
                Authorization: `Bearer ${token()}`
            }
        })
            .then(r => r.json())
            .then(users => {
                const me = users.find(u => u.id === userInfo.userId);
                if (me) {
                    setPhone(me.phoneNumber || "");
                    setDepartment(me.department || "");
                }
            });
    }, [userInfo.userId]);

    const handleSave = async () => {
        const res = await fetch(`${API_URL}/users/profile`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
            body: JSON.stringify({
                userId: userInfo.userId,
                phoneNumber: phone,
                department: department
            })
        });
        if (res.ok) setSuccess("Profile updated successfully");
        else setError("Failed to update profile");
    };

    return (
        <Box sx={{ backgroundColor: "#f5f5f5", minHeight: "100vh", py: 4 }}>
            <Box sx={{ maxWidth: 500, mx: "auto", px: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
                    <IconButton onClick={onClose}><ArrowBackIcon /></IconButton>
                    <Typography variant="h5" sx={{ fontWeight: "bold" }}>My Profile</Typography>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

                <Card elevation={2}>
                    <CardContent>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <TextField label="Email" value={userInfo.email} disabled fullWidth />
                            <TextField label="Role" value={userInfo.role} disabled fullWidth />
                            <TextField label="Phone Number" value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+60123456789" fullWidth />
                            <TextField label="Department" value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                placeholder="e.g. Maintenance, Production" fullWidth />
                            <Button variant="contained" onClick={handleSave} size="large">
                                Save Profile
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
}