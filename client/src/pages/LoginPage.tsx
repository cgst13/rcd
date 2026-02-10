import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Paper, 
  Grid, 
  InputAdornment, 
  CircularProgress,
  Alert
} from '@mui/material';
import { Person, Lock, Login } from '@mui/icons-material';
import { loginWithGoogleSheet } from '../services/googleSheets';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const user = await loginWithGoogleSheet(email, password);
      if (user) {
        login(user);
        navigate('/dashboard');
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError('An error occurred during login');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Grid container component="main" sx={{ height: '100vh' }}>
      {/* Left Side - Hero Section */}
      <Grid
        size={{ xs: false, sm: 4, md: 7 }}
        sx={{
          backgroundImage: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)', // Blue gradient
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: { xs: 'none', sm: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          p: 4,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 480 }}>
          <Box sx={{ 
            width: 80, 
            height: 80, 
            bgcolor: 'rgba(255,255,255,0.2)', 
            borderRadius: 4, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            mb: 4,
            backdropFilter: 'blur(10px)'
          }}>
            <Login sx={{ fontSize: 40 }} />
          </Box>
          <Typography variant="h2" component="h1" fontWeight="bold" gutterBottom>
            RCD System
          </Typography>
          <Typography variant="h5" sx={{ opacity: 0.9, mb: 6 }}>
            Streamlined Reports of Collections and Deposits for LGU Concepcion, Romblon.
          </Typography>
          
          <Grid container spacing={4}>
            <Grid size={{ xs: 6 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 3, borderRadius: 2, backdropFilter: 'blur(10px)' }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Secure</Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Protected access for authorized personnel only.
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 3, borderRadius: 2, backdropFilter: 'blur(10px)' }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Efficient</Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Real-time tracking and automated reporting.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
        
        {/* Decorative Elements */}
        <Box sx={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 400,
          height: 400,
          bgcolor: 'rgba(255,255,255,0.1)',
          borderRadius: '50%',
          filter: 'blur(80px)'
        }} />
        <Box sx={{
          position: 'absolute',
          bottom: -100,
          left: -100,
          width: 400,
          height: 400,
          bgcolor: 'rgba(30, 144, 255, 0.2)',
          borderRadius: '50%',
          filter: 'blur(80px)'
        }} />
      </Grid>

      {/* Right Side - Login Form */}
      <Grid size={{ xs: 12, sm: 8, md: 5 }} component={Paper} elevation={0} square sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box
          sx={{
            my: 8,
            mx: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: 400,
            width: '100%'
          }}
        >
          <Box sx={{ 
            width: 64, 
            height: 64, 
            bgcolor: 'primary.main', 
            borderRadius: '50%', 
            display: { xs: 'flex', sm: 'none' }, 
            alignItems: 'center', 
            justifyContent: 'center',
            mb: 2
          }}>
            <Login sx={{ color: 'white', fontSize: 32 }} />
          </Box>
          
          <Typography component="h1" variant="h4" fontWeight="bold" gutterBottom>
            Welcome Back
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Sign in to your account
          </Typography>
          
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 4, width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person color="action" />
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
              }}
            />
            
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading}
              sx={{ mt: 3, mb: 2, py: 1.5, fontSize: '1rem' }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
            
            <Typography variant="caption" display="block" align="center" color="text.secondary" sx={{ mt: 4 }}>
              System for Romblon LGU
            </Typography>
          </Box>
        </Box>
      </Grid>
    </Grid>
  );
};
