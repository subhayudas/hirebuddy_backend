import { PremiumUser, PremiumUserCreate, PremiumUserUpdate } from '../types';

// API Response interface
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://your-api-gateway-url.execute-api.region.amazonaws.com/dev';

/**
 * Premium API Service for frontend integration
 * This service provides a clean interface for all premium user operations
 */
export class PremiumApiService {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_BASE_URL;
  }

  /**
   * Set authentication token for API requests
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }

  /**
   * Clear authentication token
   */
  clearAuthToken() {
    this.authToken = null;
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add any additional headers from options
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const result = await response.json() as ApiResponse<T>;

      if (!response.ok) {
        console.error(`API Error (${response.status}):`, result.error);
        return {
          success: false,
          error: result.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return result;
    } catch (error) {
      console.error('API Request Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Check if a user is premium by email
   */
  async isPremiumUser(email: string): Promise<boolean> {
    if (!email || typeof email !== 'string') return false;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('Invalid email format:', email);
      return false;
    }
    
    const result = await this.makeRequest<{ isPremium: boolean }>(
      `/premium/check?email=${encodeURIComponent(email)}`
    );
    
    if (!result.success) {
      console.error('Error checking premium status:', result.error);
      return false;
    }

    return result.data?.isPremium || false;
  }

  /**
   * Get premium user data by email
   */
  async getPremiumUserData(email?: string): Promise<PremiumUser | null> {
    const endpoint = email 
      ? `/premium/users?email=${encodeURIComponent(email)}`
      : '/premium/users';
    
    const result = await this.makeRequest<{ data: PremiumUser; isPremium: boolean }>(endpoint);
    
    if (!result.success) {
      console.error('Error fetching premium user data:', result.error);
      return null;
    }

    return result.data?.data || null;
  }

  /**
   * Get all premium users (admin only)
   */
  async getAllPremiumUsers(): Promise<PremiumUser[]> {
    const result = await this.makeRequest<PremiumUser[]>(
      '/premium/users?getAll=true'
    );
    
    if (!result.success) {
      console.error('Error fetching all premium users:', result.error);
      return [];
    }

    return result.data || [];
  }

  /**
   * Add a new premium user
   */
  async addPremiumUser(userData: PremiumUserCreate): Promise<PremiumUser | null> {
    const result = await this.makeRequest<PremiumUser>('/premium/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    if (!result.success) {
      console.error('Error adding premium user:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Update premium user data
   */
  async updatePremiumUser(id: number, updates: PremiumUserUpdate): Promise<PremiumUser | null> {
    const result = await this.makeRequest<PremiumUser>('/premium/users', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    });
    
    if (!result.success) {
      console.error('Error updating premium user:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Remove premium user
   */
  async removePremiumUser(id: number): Promise<boolean> {
    const result = await this.makeRequest<{ message: string }>(
      `/premium/users?id=${id}`,
      { method: 'DELETE' }
    );
    
    if (!result.success) {
      console.error('Error removing premium user:', result.error);
      return false;
    }

    return true;
  }

  /**
   * Get premium status for current user (authenticated)
   */
  async getCurrentUserPremiumStatus(): Promise<{ isPremium: boolean; data: PremiumUser | null }> {
    const result = await this.makeRequest<{ isPremium: boolean; data: PremiumUser }>('/premium/users');
    
    if (!result.success) {
      console.error('Error getting current user premium status:', result.error);
      return { isPremium: false, data: null };
    }

    return {
      isPremium: result.data?.isPremium || false,
      data: result.data?.data || null,
    };
  }

  /**
   * Get premium data for current user (authenticated)
   */
  async getCurrentUserPremiumData(): Promise<PremiumUser | null> {
    const result = await this.makeRequest<PremiumUser>('/premium/data');
    
    if (!result.success) {
      console.error('Error getting current user premium data:', result.error);
      return null;
    }

    return result.data || null;
  }
}

// Export singleton instance
export const premiumApiService = new PremiumApiService();

// Export for direct usage
export default premiumApiService;
