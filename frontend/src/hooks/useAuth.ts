import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { RootState } from '../store';
import { loginUser, logoutUser, checkAuth } from '../store/slices/authSlice';
import { authService } from '../services/auth.service';

export const useAuth = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const { user, isAuthenticated, isLoading, error } = useSelector(
    (state: RootState) => state.auth
  );

  useEffect(() => {
    // Check authentication status on mount
    const token = localStorage.getItem('token');
    if (token && !isAuthenticated) {
      dispatch(checkAuth() as any);
    }
  }, [dispatch, isAuthenticated]);

  const login = async (email: string, password: string) => {
    try {
      const result = await dispatch(loginUser({ email, password }) as any);
      if (loginUser.fulfilled.match(result)) {
        toast.success(t('auth.loginSuccess'));
        navigate('/');
      } else {
        toast.error(t('errors.loginFailed'));
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    }
  };

  const register = async (userData: any) => {
    try {
      const result = await authService.register(userData);
      if (result.success) {
        toast.success(t('auth.registerSuccess'));
        navigate('/login');
      } else {
        toast.error(t('errors.registrationFailed'));
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    }
  };

  const logout = async () => {
    dispatch(logoutUser());
    navigate('/login');
    toast.info(t('auth.logoutSuccess'));
  };

  const checkPermission = (permission: string): boolean => {
    if (!user) return false;
    // Implement permission checking logic
    return true;
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    checkPermission,
  };
};