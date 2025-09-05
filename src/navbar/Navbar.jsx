import React from "react";
import { AppBar, Toolbar, Typography, Box, IconButton } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

export default function Header() {
  return (
    <AppBar position="static" color="primary" elevation={3}>
      <Toolbar sx={{ justifyContent: "space-between" }}>
        {/* Left side: menu icon (optional) */}
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        {/* Center: title */}
        <Typography
          variant="h6"
          component="div"
          sx={{
            flexGrow: 1,
            textAlign: "left",
            fontWeight: "bold",
            letterSpacing: 1,
          }}
        >
          BEAV Metric
        </Typography>

        {/* Right side: optional placeholder */}
        <Box sx={{ width: 48 }} /> {/* Keeps title centered */}
      </Toolbar>
    </AppBar>
  );
}
