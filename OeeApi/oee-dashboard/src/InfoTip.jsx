import { useState } from "react";
import { IconButton, Tooltip, ClickAwayListener, Box } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

/**
 * Small "(i)" info icon that pops open an explanation on click (works on
 * both desktop click and mobile tap — unlike a hover-only Tooltip).
 * Usage: <InfoTip title="Availability = Run Time / Planned Time × 100" />
 */
export default function InfoTip({ title, iconColor }) {
    const [open, setOpen] = useState(false);

    return (
        <ClickAwayListener onClickAway={() => setOpen(false)}>
            <Box component="span" sx={{ display: "inline-flex", verticalAlign: "middle" }}>
                <Tooltip
                    title={title}
                    open={open}
                    onClose={() => setOpen(false)}
                    disableFocusListener
                    disableHoverListener
                    disableTouchListener
                    arrow
                    placement="top"
                    PopperProps={{ sx: { "& .MuiTooltip-tooltip": { fontSize: "0.8rem", maxWidth: 260 } } }}
                >
                    <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
                        sx={{ p: 0.25, ml: 0.3, color: iconColor || "inherit", opacity: 0.85 }}
                        aria-label="info"
                    >
                        <InfoOutlinedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                </Tooltip>
            </Box>
        </ClickAwayListener>
    );
}
