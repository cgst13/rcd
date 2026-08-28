import React from 'react';
import { Snackbar, Alert, AlertTitle, Slide } from '@mui/material';
import type { SlideProps } from '@mui/material';

interface NotificationProps {
  open: boolean;
  onClose: () => void;
  message: string;
  severity?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
}

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}

export const Notification: React.FC<NotificationProps> = ({
  open,
  onClose,
  message,
  severity = 'info',
  title
}) => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={5000}
      onClose={onClose}
      TransitionComponent={SlideTransition}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert 
        onClose={onClose} 
        severity={severity} 
        variant="filled"
        elevation={6}
        sx={{ 
          width: '100%', 
          borderRadius: 2,
          fontWeight: 500,
          '& .MuiAlert-icon': {
            fontSize: 24
          }
        }}
      >
        {title && <AlertTitle sx={{ fontWeight: 'bold' }}>{title}</AlertTitle>}
        {message}
      </Alert>
    </Snackbar>
  );
};
