// Simple test script to verify API endpoints
// Run with: node test-api.js

const baseUrl = 'http://localhost:3000/api';

// Test health endpoint
async function testHealth() {
  try {
    const response = await fetch(`${baseUrl}/health`);
    const data = await response.json();
    console.log('✅ Health check:', data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
}

// Test registration
async function testRegister() {
  try {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'TestPassword123!',
        phoneNumber: '+1234567890',
        role: 'client'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Registration successful:', data.message);
      return data.token;
    } else {
      console.log('❌ Registration failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Registration error:', error.message);
  }
}

// Test login
async function testLogin() {
  try {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123!'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Login successful:', data.message);
      return data.token;
    } else {
      console.log('❌ Login failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Login error:', error.message);
  }
}

// Test protected route
async function testMe(token) {
  try {
    const response = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Profile fetch successful:', data.user.email);
    } else {
      console.log('❌ Profile fetch failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Profile fetch error:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🧪 Testing API endpoints...\n');
  
  await testHealth();
  
  // Note: These tests require a running database
  console.log('\n📝 Database-dependent tests (require PostgreSQL):');
  console.log('- Registration test');
  console.log('- Login test');
  console.log('- Profile fetch test');
  
  console.log('\n💡 To run full tests:');
  console.log('1. Set up PostgreSQL database');
  console.log('2. Update DATABASE_URL in .env');
  console.log('3. Run: npm run prisma:migrate');
  console.log('4. Start server: npm run dev');
  console.log('5. Run this test script');
}

runTests();

