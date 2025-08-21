const crypto = require('crypto');

// Simple JWT generation for testing
function generateTestToken(user) {
  const jwtSecret = process.env.JWT_SECRET || 'NR/NZ0G2grSaoyDDU/FcXVaf60U43CtYBjGARNCyGgiXh2OYl59JortoXm8As3u8D8LKZ2JgQ3rgFSAM6WUw/A==';
  
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    userId: user.id,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
  };

  const base64UrlEncode = (input) => {
    const base64 = Buffer.from(input, 'utf8').toString('base64');
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(`${encodedHeader}.${encodedPayload}.${jwtSecret}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Test user
const testUser = {
  id: 'test-user-123',
  email: 'test@example.com'
};

const token = generateTestToken(testUser);
console.log('Generated JWT Token:');
console.log(token);
console.log('\nTest the API with:');
console.log(`curl -X GET "https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev/premium/test" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json"`);
