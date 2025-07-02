import axios from 'axios';
import { API_BASE_URL } from '../config/constants';

const API_URL = `${API_BASE_URL}/auth`;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  hebrewFirstName?: string;
  hebrewLastName?: string;
  organizationName?: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      hebrewFirstName?: string;
      hebrewLastName?: string;
      role: string;
    };
    token: string;
    refreshToken: string;
  };
}

class AuthService {
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await axios.post(`${API_URL}/login`, { email, password });
    return response.data;
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await axios.post(`${API_URL}/register`, data);
    return response.data;
  }

  async logout(): Promise<void> {
    const token = localStorage.getItem('token');
    if (token) {
      await axios.post(`${API_URL}/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }

  async getCurrentUser(): Promise<any> {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No token found');
    }
    
    const response = await axios.get(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  async refreshToken(): Promise<string> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token found');
    }
    
    const response = await axios.post(`${API_URL}/refresh`, { refreshToken });
    const { token } = response.data.data;
    localStorage.setItem('token', token);
    return token;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const token = localStorage.getItem('token');
    await axios.post(`${API_URL}/change-password`, {
      currentPassword,
      newPassword
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async forgotPassword(email: string): Promise<void> {
    await axios.post(`${API_URL}/forgot-password`, { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await axios.post(`${API_URL}/reset-password`, { token, newPassword });
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const authService = new AuthService();