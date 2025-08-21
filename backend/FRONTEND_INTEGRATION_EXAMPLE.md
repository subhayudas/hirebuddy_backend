# Frontend Integration Example

This document provides examples of how to integrate the Email API endpoints into your frontend application.

## API Client Setup

First, create an API client to handle communication with the backend:

```typescript
// src/services/apiClient.ts
class ApiClient {
  private baseUrl: string;
  private token: string | null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.token = null;
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Email API methods
  async getEmailUsage() {
    return this.request('/email/usage');
  }

  async incrementEmailCount(count: number = 1) {
    return this.request('/email/increment', {
      method: 'POST',
      body: JSON.stringify({ count }),
    });
  }
}

// Create singleton instance
export const apiClient = new ApiClient('https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev');
```

## Email Service

Create a dedicated service for email operations:

```typescript
// src/services/emailService.ts
import { apiClient } from './apiClient';

export interface EmailUsage {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  canSendEmail: boolean;
}

export interface EmailIncrementResult {
  previousCount: number;
  newCount: number;
  limit: number;
  remaining: number;
  canSendEmail: boolean;
}

export class EmailService {
  /**
   * Get current email usage statistics
   */
  static async getEmailUsage(): Promise<EmailUsage> {
    try {
      const response = await apiClient.getEmailUsage();
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to get email usage');
    } catch (error) {
      console.error('Error getting email usage:', error);
      throw error;
    }
  }

  /**
   * Increment email count
   */
  static async incrementEmailCount(count: number = 1): Promise<EmailIncrementResult> {
    try {
      const response = await apiClient.incrementEmailCount(count);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to increment email count');
    } catch (error) {
      console.error('Error incrementing email count:', error);
      throw error;
    }
  }

  /**
   * Check if user can send emails
   */
  static async canSendEmail(): Promise<boolean> {
    try {
      const usage = await this.getEmailUsage();
      return usage.canSendEmail;
    } catch (error) {
      console.error('Error checking email availability:', error);
      return false;
    }
  }

  /**
   * Send email and increment count
   */
  static async sendEmailAndIncrement(
    emailData: any,
    count: number = 1
  ): Promise<{ emailSent: boolean; incrementResult?: EmailIncrementResult }> {
    try {
      // First check if user can send emails
      const canSend = await this.canSendEmail();
      if (!canSend) {
        return { emailSent: false };
      }

      // Send email (implement your email sending logic here)
      const emailSent = await this.sendEmail(emailData);
      
      if (emailSent) {
        // Increment count only if email was sent successfully
        const incrementResult = await this.incrementEmailCount(count);
        return { emailSent: true, incrementResult };
      }

      return { emailSent: false };
    } catch (error) {
      console.error('Error sending email and incrementing count:', error);
      return { emailSent: false };
    }
  }

  /**
   * Send email (implement your email sending logic)
   */
  private static async sendEmail(emailData: any): Promise<boolean> {
    // Implement your email sending logic here
    // This could be using a service like SendGrid, AWS SES, etc.
    try {
      // Example implementation
      // const response = await emailProvider.send(emailData);
      // return response.success;
      
      // For now, return true as placeholder
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }
}
```

## React Hook Example

Create a React hook for managing email usage:

```typescript
// src/hooks/useEmailUsage.ts
import { useState, useEffect, useCallback } from 'react';
import { EmailService, EmailUsage } from '../services/emailService';

export const useEmailUsage = () => {
  const [usage, setUsage] = useState<EmailUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await EmailService.getEmailUsage();
      setUsage(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch email usage');
    } finally {
      setLoading(false);
    }
  }, []);

  const incrementCount = useCallback(async (count: number = 1) => {
    try {
      setError(null);
      const result = await EmailService.incrementEmailCount(count);
      
      // Update local state
      if (usage) {
        setUsage({
          ...usage,
          used: result.newCount,
          remaining: result.remaining,
          percentage: (result.newCount / result.limit) * 100,
          canSendEmail: result.canSendEmail,
        });
      }
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to increment email count');
      throw err;
    }
  }, [usage]);

  const sendEmailAndIncrement = useCallback(async (emailData: any, count: number = 1) => {
    try {
      setError(null);
      const result = await EmailService.sendEmailAndIncrement(emailData, count);
      
      if (result.emailSent && result.incrementResult) {
        // Update local state
        if (usage) {
          setUsage({
            ...usage,
            used: result.incrementResult.newCount,
            remaining: result.incrementResult.remaining,
            percentage: (result.incrementResult.newCount / result.incrementResult.limit) * 100,
            canSendEmail: result.incrementResult.canSendEmail,
          });
        }
      }
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
      throw err;
    }
  }, [usage]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    usage,
    loading,
    error,
    fetchUsage,
    incrementCount,
    sendEmailAndIncrement,
    canSendEmail: usage?.canSendEmail ?? false,
  };
};
```

## React Component Example

Example React component using the email hook:

```typescript
// src/components/EmailUsageDisplay.tsx
import React from 'react';
import { useEmailUsage } from '../hooks/useEmailUsage';

export const EmailUsageDisplay: React.FC = () => {
  const {
    usage,
    loading,
    error,
    fetchUsage,
    incrementCount,
    canSendEmail,
  } = useEmailUsage();

  const handleIncrement = async () => {
    try {
      await incrementCount(1);
    } catch (error) {
      console.error('Failed to increment:', error);
    }
  };

  if (loading) {
    return <div>Loading email usage...</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error: {error}</p>
        <button onClick={fetchUsage}>Retry</button>
      </div>
    );
  }

  if (!usage) {
    return <div>No usage data available</div>;
  }

  return (
    <div className="email-usage">
      <h3>Email Usage</h3>
      <div className="usage-stats">
        <p>
          Used: {usage.used} / {usage.limit} emails
        </p>
        <p>Remaining: {usage.remaining} emails</p>
        <p>Percentage: {usage.percentage.toFixed(1)}%</p>
        <p>Can send email: {canSendEmail ? 'Yes' : 'No'}</p>
      </div>
      
      <div className="usage-bar">
        <div 
          className="usage-progress" 
          style={{ width: `${usage.percentage}%` }}
        />
      </div>
      
      <button 
        onClick={handleIncrement}
        disabled={!canSendEmail}
      >
        Test Increment
      </button>
      
      <button onClick={fetchUsage}>
        Refresh
      </button>
    </div>
  );
};
```

## Email Sending Component Example

Example component for sending emails with usage tracking:

```typescript
// src/components/EmailSender.tsx
import React, { useState } from 'react';
import { useEmailUsage } from '../hooks/useEmailUsage';

interface EmailFormData {
  to: string;
  subject: string;
  body: string;
}

export const EmailSender: React.FC = () => {
  const { sendEmailAndIncrement, canSendEmail, usage } = useEmailUsage();
  const [formData, setFormData] = useState<EmailFormData>({
    to: '',
    subject: '',
    body: '',
  });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canSendEmail) {
      alert('You have reached your email limit');
      return;
    }

    setSending(true);
    try {
      const result = await sendEmailAndIncrement(formData, 1);
      
      if (result.emailSent) {
        alert('Email sent successfully!');
        setFormData({ to: '', subject: '', body: '' });
      } else {
        alert('Failed to send email');
      }
    } catch (error) {
      alert('Error sending email: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="email-sender">
      <h3>Send Email</h3>
      
      {usage && (
        <div className="usage-info">
          <p>
            Emails remaining: {usage.remaining} / {usage.limit}
          </p>
          {!canSendEmail && (
            <p className="warning">You have reached your email limit!</p>
          )}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="to">To:</label>
          <input
            id="to"
            type="email"
            value={formData.to}
            onChange={(e) => setFormData({ ...formData, to: e.target.value })}
            required
          />
        </div>
        
        <div>
          <label htmlFor="subject">Subject:</label>
          <input
            id="subject"
            type="text"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            required
          />
        </div>
        
        <div>
          <label htmlFor="body">Message:</label>
          <textarea
            id="body"
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            required
          />
        </div>
        
        <button 
          type="submit" 
          disabled={!canSendEmail || sending}
        >
          {sending ? 'Sending...' : 'Send Email'}
        </button>
      </form>
    </div>
  );
};
```

## Authentication Integration

Make sure to set the JWT token in your API client when the user logs in:

```typescript
// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

interface AuthContextType {
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem('authToken');
  });

  const setToken = (newToken: string) => {
    setTokenState(newToken);
    localStorage.setItem('authToken', newToken);
    apiClient.setToken(newToken);
  };

  const logout = () => {
    setTokenState(null);
    localStorage.removeItem('authToken');
    apiClient.clearToken();
  };

  useEffect(() => {
    if (token) {
      apiClient.setToken(token);
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

## Error Handling

Implement proper error handling for different scenarios:

```typescript
// src/utils/errorHandler.ts
export const handleEmailError = (error: any) => {
  if (error.message.includes('401')) {
    // Authentication error - redirect to login
    window.location.href = '/login';
  } else if (error.message.includes('422')) {
    // Validation error
    return 'Invalid request data';
  } else if (error.message.includes('500')) {
    // Server error
    return 'Server error. Please try again later.';
  } else {
    // Network or other error
    return 'Network error. Please check your connection.';
  }
};
```

## Testing

Test your email integration:

```typescript
// src/tests/emailService.test.ts
import { EmailService } from '../services/emailService';

// Mock the API client
jest.mock('../services/apiClient', () => ({
  apiClient: {
    getEmailUsage: jest.fn(),
    incrementEmailCount: jest.fn(),
  },
}));

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get email usage successfully', async () => {
    const mockUsage = {
      used: 50,
      limit: 125,
      remaining: 75,
      percentage: 40,
      canSendEmail: true,
    };

    const mockResponse = {
      success: true,
      data: mockUsage,
    };

    // Mock the API call
    const { apiClient } = require('../services/apiClient');
    apiClient.getEmailUsage.mockResolvedValue(mockResponse);

    const result = await EmailService.getEmailUsage();
    expect(result).toEqual(mockUsage);
  });

  it('should handle API errors', async () => {
    const mockResponse = {
      success: false,
      error: 'Database error',
    };

    const { apiClient } = require('../services/apiClient');
    apiClient.getEmailUsage.mockResolvedValue(mockResponse);

    await expect(EmailService.getEmailUsage()).rejects.toThrow('Database error');
  });
});
```

This integration example provides a complete solution for connecting your frontend to the email API endpoints, including proper error handling, state management, and testing.
