import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Typography, 
  Paper, 
  Grid, 
  InputAdornment, 
  CircularProgress,
  Alert,
  IconButton, 
  Tooltip
} from '@mui/material';
import { 
  Lock, 
  Email, 
  AccountBalance,
  ArrowForward,
  Security,
  AdminPanelSettings
} from '@mui/icons-material';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  // Sign In state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  
  // UI status
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn(signInEmail, signInPassword);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Invalid email or password');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign in');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        bgcolor: '#f8fafc',
        backgroundImage: 'radial-gradient(at 0% 0%, #e0f2fe 0, transparent 50%), radial-gradient(at 100% 100%, #f0f9ff 0, transparent 50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, sm: 3, md: 4 }
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 920,
          width: '100%',
          borderRadius: 1.5,
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff'
        }}
      >
        <Grid container>
          {/* Left Hero Side */}
          <Grid
            size={{ xs: 12, md: 5 }}
            sx={{
              bgcolor: '#f0f9ff',
              p: { xs: 4, sm: 5 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              borderRight: { md: '1px solid #e2e8f0' },
              position: 'relative'
            }}
          >
            <Box>
              <Box sx={{ 
                width: 48, 
                height: 48, 
                bgcolor: '#0284c7', 
                color: '#ffffff', 
                borderRadius: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                mb: 3
              }}>
                <AccountBalance sx={{ fontSize: 28 }} />
              </Box>
              <Typography variant="h4" fontWeight="800" sx={{ color: '#0f172a', letterSpacing: -0.5, mb: 1 }}>
                RCD System
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 4, lineHeight: 1.6 }}>
                Report of Collections and Deposits System for LGU Concepcion, Romblon.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                <Security sx={{ color: '#0284c7' }} />
                <Box>
                  <Typography variant="subtitle2" fontWeight="700" sx={{ color: '#0f172a' }}>
                    Role-Based Access
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Isolated collector data & admin central monitoring.
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, bgcolor: '#ffffff', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                <AdminPanelSettings sx={{ color: '#0284c7' }} />
                <Box>
                  <Typography variant="subtitle2" fontWeight="700" sx={{ color: '#0f172a' }}>
                    Managed Accounts
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    User profiles and access are issued by System Administrators.
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Typography variant="caption" sx={{ color: '#94a3b8', mt: 4 }}>
              © 2026 Municipality of Concepcion. All rights reserved.
            </Typography>
          </Grid>

          {/* Right Form Side */}
          <Grid size={{ xs: 12, md: 7 }} sx={{ p: { xs: 4, sm: 6 }, display: 'flex', alignItems: 'center' }}>
            <Box sx={{ maxWidth: 420, width: '100%', mx: 'auto' }}>
              <Box sx={{ mb: 3.5 }}>
                <Typography variant="h5" fontWeight="800" sx={{ color: '#0f172a' }}>
                  Sign In
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                  Enter your authorized municipal credentials to access your account.
                </Typography>
              </Box>

              {/* Feedback Alert */}
              {error && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 1, border: '1px solid #fee2e2' }}>
                  {error}
                </Alert>
              )}

              {/* SIGN IN FORM */}
              <Box component="form" onSubmit={handleSignIn}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  label="Email Address"
                  name="email"
                  autoComplete="email"
                  autoFocus
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email color="action" fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Password"
                  type="password"
                  id="password"
                  autoComplete="current-password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock color="action" fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                <Box sx={{ mt: 3.5, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Sign In
                  </Typography>
                  <Tooltip title="Sign In to Account" arrow>
                    <IconButton
                      type="submit"
                      color="primary"
                      disabled={isLoading}
                      sx={{
                        width: 44,
                        height: 44,
                        bgcolor: '#0284c7',
                        color: '#ffffff',
                        borderRadius: 1,
                        '&:hover': {
                          bgcolor: '#0369a1',
                          color: '#ffffff'
                        }
                      }}
                    >
                      {isLoading ? <CircularProgress size={20} color="inherit" /> : <ArrowForward />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};
