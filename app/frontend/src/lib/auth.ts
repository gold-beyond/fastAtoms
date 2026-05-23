import axios, { AxiosError, AxiosInstance } from 'axios';
import { getAPIBaseURL } from './config';

class RPApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private getBaseURL() {
    return getAPIBaseURL();
  }

  async getCurrentUser() {
    try {
      const response = await this.client.get(
        `${this.getBaseURL()}/api/v1/auth/me`
      );
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          return null;
        }
        throw new Error(
          error.response?.data?.detail || 'Failed to get user info'
        );
      }
      throw new Error('Failed to get user info');
    }
  }

  async login() {
    try {
      const response = await this.client.get(
        `${this.getBaseURL()}/api/v1/auth/login`
      );
      window.location.href = response.data.redirect_url;
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(
          error.response?.data?.detail || 'Failed to initiate login'
        );
      }
      throw new Error('Failed to initiate login');
    }
  }

  async logout() {
    try {
      const response = await this.client.get(
        `${this.getBaseURL()}/api/v1/auth/logout`
      );
      window.location.href = response.data.redirect_url;
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.detail || 'Failed to logout');
      }
      throw new Error('Failed to logout');
    }
  }
}

export const authApi = new RPApi();
