import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemIcon, 
  ListItemButton,
  Switch, 
  Divider,
  Avatar,
  Button
} from '@mui/material';
import { 
  Notifications, 
  DarkMode, 
  Language, 
  Security, 
  Person, 
  CloudDownload,
  DeleteForever,
  Info
} from '@mui/icons-material';
import { useAuth } from '../context/useAuth';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Notification } from '../components/Notification';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [openClearDialog, setOpenClearDialog] = useState(false);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  const handleExportData = () => {
    // Mock export functionality
    const data = localStorage.getItem('rcd_reports');
    if (!data) {
        setNotification({ open: true, message: 'No data to export.', severity: 'warning' });
        return;
    }
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rcd_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setNotification({ open: true, message: 'Data exported successfully.', severity: 'success' });
  };

  const handleClearData = () => {
    // Clear reports from local storage
    localStorage.removeItem('rcd_reports');
    setOpenClearDialog(false);
    setNotification({ open: true, message: 'Local data cleared successfully.', severity: 'success' });
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ mb: 4 }}>
        Settings
      </Typography>

      {/* Profile Section */}
      <Paper sx={{ p: 3, mb: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
        <Avatar 
            sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: '2rem' }}
        >
            {user?.name?.charAt(0) || 'U'}
        </Avatar>
        <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight="bold">{user?.name || 'User'}</Typography>
            <Typography variant="body2" color="text.secondary">{user?.email || 'user@example.com'}</Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'primary.main' }}>
                {user?.role || 'Administrator'}
            </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Person />}>
            Edit Profile
        </Button>
      </Paper>

      <Paper sx={{ maxWidth: '100%', mb: 3 }}>
        <List subheader={<Typography variant="overline" sx={{ px: 2, pt: 2, display: 'block' }}>Preferences</Typography>}>
          <ListItem>
            <ListItemIcon>
              <Notifications />
            </ListItemIcon>
            <ListItemText primary="Notifications" secondary="Enable email notifications for new reports" />
            <Switch defaultChecked />
          </ListItem>
          <Divider variant="inset" component="li" />
          
          <ListItem>
            <ListItemIcon>
              <DarkMode />
            </ListItemIcon>
            <ListItemText primary="Dark Mode" secondary="Toggle dark/light theme" />
            <Switch />
          </ListItem>
          <Divider variant="inset" component="li" />
          
          <ListItem>
            <ListItemIcon>
              <Language />
            </ListItemIcon>
            <ListItemText primary="Language" secondary="English (US)" />
          </ListItem>
        </List>
      </Paper>

      <Paper sx={{ maxWidth: '100%', mb: 3 }}>
        <List subheader={<Typography variant="overline" sx={{ px: 2, pt: 2, display: 'block' }}>Data & Security</Typography>}>
            <ListItemButton onClick={handleExportData}>
                <ListItemIcon><CloudDownload /></ListItemIcon>
                <ListItemText primary="Export Data" secondary="Download a backup of your local data" />
            </ListItemButton>
            <Divider variant="inset" component="li" />

            <ListItemButton onClick={() => setOpenClearDialog(true)}>
                <ListItemIcon><DeleteForever color="error" /></ListItemIcon>
                <ListItemText 
                    primary="Clear Local Cache" 
                    secondary="Remove locally stored reports (Caution)" 
                    primaryTypographyProps={{ color: 'error.main' }}
                />
            </ListItemButton>
            <Divider variant="inset" component="li" />
            
            <ListItem>
                <ListItemIcon>
                <Security />
                </ListItemIcon>
                <ListItemText primary="Security" secondary="Change password and security settings" />
            </ListItem>
        </List>
      </Paper>

      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <Info fontSize="small" /> RCD System v1.0.0
        </Typography>
        <Typography variant="caption">
            © 2024 Municipality of San Vicente. All rights reserved.
        </Typography>
      </Box>

      <ConfirmDialog
        open={openClearDialog}
        onClose={() => setOpenClearDialog(false)}
        onConfirm={handleClearData}
        title="Clear Local Data?"
        message="This will remove all reports stored in your browser's local storage. This action cannot be undone."
        confirmText="Clear Data"
        severity="error"
      />

      <Notification
        open={notification.open}
        onClose={() => setNotification({ ...notification, open: false })}
        message={notification.message}
        severity={notification.severity}
      />
    </Box>
  );
};
