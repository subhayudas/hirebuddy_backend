# 🎯 HireBuddy Referral System - Frontend Integration Guide

## 📋 Quick Start

This guide shows how to integrate the referral system into your frontend application.

## 🔧 Setup

### 1. API Base URL
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
```

### 2. Authentication Helper
```javascript
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};
```

## 🚀 Core Integration Examples

### 1. Referral Code Input Component

```jsx
import React, { useState } from 'react';

const ReferralCodeInput = ({ onCodeApplied, onError }) => {
  const [referralCode, setReferralCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(null);

  const validateCode = async (code) => {
    if (!code || !/^HB-[A-F0-9]{8}$/i.test(code)) {
      setIsValid(false);
      return;
    }

    setIsValidating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/referral/validate?code=${code}`);
      const data = await response.json();
      
      if (data.success && data.data.valid) {
        setIsValid(true);
      } else {
        setIsValid(false);
      }
    } catch (error) {
      setIsValid(false);
      onError('Failed to validate referral code');
    } finally {
      setIsValidating(false);
    }
  };

  const handleCodeChange = (e) => {
    const code = e.target.value.toUpperCase();
    setReferralCode(code);
    if (code.length === 11) { // HB-XXXXXXXX format
      validateCode(code);
    } else {
      setIsValid(null);
    }
  };

  return (
    <div className="referral-code-input">
      <label htmlFor="referralCode">Referral Code (Optional)</label>
      <input
        id="referralCode"
        type="text"
        value={referralCode}
        onChange={handleCodeChange}
        placeholder="HB-XXXXXXXX"
        maxLength={11}
        className={`form-control ${isValid === true ? 'is-valid' : isValid === false ? 'is-invalid' : ''}`}
      />
      {isValidating && <div className="text-muted">Validating...</div>}
      {isValid === true && <div className="text-success">✓ Valid referral code</div>}
      {isValid === false && <div className="text-danger">✗ Invalid referral code</div>}
    </div>
  );
};

export default ReferralCodeInput;
```

### 2. Signup with Referral Code

```jsx
import React, { useState } from 'react';
import ReferralCodeInput from './ReferralCodeInput';

const SignupForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    referralCode: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // 1. Create user account first
      const signupResponse = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName
        })
      });

      if (!signupResponse.ok) {
        throw new Error('Signup failed');
      }

      // 2. Apply referral code if provided
      if (formData.referralCode) {
        const referralResponse = await fetch(`${API_BASE_URL}/referral/apply-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referralCode: formData.referralCode,
            userEmail: formData.email
          })
        });

        if (!referralResponse.ok) {
          console.warn('Referral code application failed, but signup succeeded');
        }
      }

      // 3. Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Full Name</label>
        <input
          type="text"
          value={formData.fullName}
          onChange={(e) => setFormData({...formData, fullName: e.target.value})}
          required
        />
      </div>

      <div className="form-group">
        <label>Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          required
        />
      </div>

      <div className="form-group">
        <label>Password</label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          required
        />
      </div>

      <ReferralCodeInput
        onCodeApplied={(code) => setFormData({...formData, referralCode: code})}
        onError={setError}
      />

      {error && <div className="alert alert-danger">{error}</div>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating Account...' : 'Sign Up'}
      </button>
    </form>
  );
};

export default SignupForm;
```

### 3. Referral Dashboard Component

```jsx
import React, { useState, useEffect } from 'react';

const ReferralDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReferralStats();
  }, []);

  const fetchReferralStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/referral/stats`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch referral stats');
      }

      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateReferralCode = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/referral/generate-code`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to generate referral code');
      }

      const data = await response.json();
      setStats(prev => ({
        ...prev,
        user: {
          ...prev.user,
          referralCode: data.data.referralCode
        }
      }));
    } catch (error) {
      setError(error.message);
    }
  };

  const copyReferralCode = () => {
    if (stats?.user?.referralCode) {
      navigator.clipboard.writeText(stats.user.referralCode);
      // Show success message
    }
  };

  const shareReferralLink = () => {
    const referralLink = `${window.location.origin}/signup?ref=${stats?.user?.referralCode}`;
    navigator.clipboard.writeText(referralLink);
    // Show success message
  };

  if (loading) return <div>Loading referral stats...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="referral-dashboard">
      <h2>Referral Program</h2>
      
      {/* Referral Code Section */}
      <div className="referral-code-section">
        <h3>Your Referral Code</h3>
        {stats?.user?.referralCode ? (
          <div className="referral-code-display">
            <div className="code">{stats.user.referralCode}</div>
            <button onClick={copyReferralCode} className="btn btn-secondary">
              Copy Code
            </button>
            <button onClick={shareReferralLink} className="btn btn-primary">
              Share Link
            </button>
          </div>
        ) : (
          <button onClick={generateReferralCode} className="btn btn-primary">
            Generate Referral Code
          </button>
        )}
      </div>

      {/* Progress Section */}
      <div className="progress-section">
        <h3>Your Progress</h3>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${stats?.statistics?.progressPercentage || 0}%` }}
          />
        </div>
        <div className="progress-text">
          {stats?.statistics?.completedReferrals || 0} / 10 referrals completed
          ({stats?.statistics?.progressPercentage || 0}%)
        </div>
        <div className="progress-status">
          {stats?.statistics?.referralsNeededForPremium > 0 ? (
            `${stats.statistics.referralsNeededForPremium} more referrals needed for premium access`
          ) : (
            <div className="premium-unlocked">
              🎉 Premium access unlocked!
            </div>
          )}
        </div>
      </div>

      {/* Statistics Section */}
      <div className="stats-section">
        <h3>Referral Statistics</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-number">{stats?.statistics?.totalReferrals || 0}</div>
            <div className="stat-label">Total Referrals</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{stats?.statistics?.completedReferrals || 0}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{stats?.statistics?.pendingReferrals || 0}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{stats?.statistics?.expiredReferrals || 0}</div>
            <div className="stat-label">Expired</div>
          </div>
        </div>
      </div>

      {/* Referrals List */}
      <div className="referrals-list">
        <h3>Your Referrals</h3>
        {stats?.referrals?.length > 0 ? (
          <div className="referrals-table">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.referrals.map((referral) => (
                  <tr key={referral.id}>
                    <td>{referral.referred_email}</td>
                    <td>
                      <span className={`status status-${referral.status}`}>
                        {referral.status}
                      </span>
                    </td>
                    <td>{new Date(referral.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-referrals">
            No referrals yet. Share your referral code to get started!
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralDashboard;
```

### 4. Complete Referral (Backend Integration)

```javascript
// Call this when a user completes onboarding
const completeReferral = async (userEmail) => {
  try {
    // Find the referral for this user
    const response = await fetch(`${API_BASE_URL}/referral/complete`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        // You'll need to find the referral ID by email
        // This might require a separate endpoint or database query
        referralId: 'referral-uuid'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to complete referral');
    }

    const data = await response.json();
    console.log('Referral completed:', data);
  } catch (error) {
    console.error('Error completing referral:', error);
  }
};
```

## 🎨 CSS Styles

```css
/* Referral Dashboard Styles */
.referral-dashboard {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.referral-code-section {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.referral-code-display {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.code {
  font-family: monospace;
  font-size: 18px;
  font-weight: bold;
  background: #e9ecef;
  padding: 8px 12px;
  border-radius: 4px;
  border: 2px solid #dee2e6;
}

.progress-section {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid #dee2e6;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background: #e9ecef;
  border-radius: 10px;
  overflow: hidden;
  margin: 10px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745, #20c997);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 16px;
  font-weight: 500;
  margin: 10px 0;
}

.premium-unlocked {
  color: #28a745;
  font-weight: bold;
  font-size: 18px;
}

.stats-section {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid #dee2e6;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
  margin-top: 15px;
}

.stat-item {
  text-align: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  color: #007bff;
}

.stat-label {
  font-size: 14px;
  color: #6c757d;
  margin-top: 5px;
}

.referrals-list {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.referrals-table {
  margin-top: 15px;
}

.referrals-table table {
  width: 100%;
  border-collapse: collapse;
}

.referrals-table th,
.referrals-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #dee2e6;
}

.referrals-table th {
  background: #f8f9fa;
  font-weight: 600;
}

.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.status-completed {
  background: #d4edda;
  color: #155724;
}

.status-pending {
  background: #fff3cd;
  color: #856404;
}

.status-expired {
  background: #f8d7da;
  color: #721c24;
}

.no-referrals {
  text-align: center;
  color: #6c757d;
  font-style: italic;
  padding: 40px;
}

/* Form Styles */
.referral-code-input {
  margin: 15px 0;
}

.referral-code-input input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-family: monospace;
  text-transform: uppercase;
}

.referral-code-input input.is-valid {
  border-color: #28a745;
}

.referral-code-input input.is-invalid {
  border-color: #dc3545;
}

/* Button Styles */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  display: inline-block;
  transition: all 0.2s;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

## 🔄 Complete Integration Flow

### 1. Signup Flow
```javascript
// 1. User enters referral code during signup
// 2. Validate code format and availability
// 3. Create user account
// 4. Apply referral code
// 5. Redirect to dashboard
```

### 2. Dashboard Flow
```javascript
// 1. Load user's referral statistics
// 2. Generate referral code if needed
// 3. Display progress and statistics
// 4. Allow sharing of referral code/link
```

### 3. Referral Completion Flow
```javascript
// 1. User completes onboarding
// 2. Find referral by email
// 3. Mark referral as completed
// 4. Update referrer's statistics
// 5. Check for premium access
```

## 🚀 Next Steps

1. **Integrate components** into your existing signup flow
2. **Add referral dashboard** to user profile
3. **Implement sharing functionality** (social media, email)
4. **Add email notifications** for referral events
5. **Create admin dashboard** for monitoring

## 📞 Support

For integration help:
- Check the API documentation
- Review the test cases
- Test with the provided examples
- Contact the backend team for assistance

---

**Ready to start referring! 🚀**
