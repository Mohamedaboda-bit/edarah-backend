// Test database data availability
const { DatabaseConnectionService } = require('./dist/utils/databaseConnection');

async function testDatabaseData() {
  console.log('Testing database data availability...');
  
  // Mock database info (you'll need to replace with your actual connection string)
  const connectionString = process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/database';
  const dbType = 'postgresql';
  
  try {
    // Test 1: Check if tables exist and have data
    console.log('\n1. Checking table data...');
    
    const simpleQueries = [
      'SELECT COUNT(*) as count FROM users',
      'SELECT COUNT(*) as count FROM "Freelancer_profile"',
      'SELECT COUNT(*) as count FROM freelancer_stats',
      'SELECT COUNT(*) as count FROM proposals',
      'SELECT COUNT(*) as count FROM "Project_freelancer"'
    ];
    
    for (const query of simpleQueries) {
      try {
        const result = await DatabaseConnectionService.executeQuery(connectionString, dbType, query);
        console.log(`${query}: ${result[0]?.count || 0} records`);
      } catch (error) {
        console.log(`${query}: ERROR - ${error.message}`);
      }
    }
    
    // Test 2: Check the actual query that's failing
    console.log('\n2. Testing the actual query...');
    const actualQuery = `
      SELECT 
        fp.id AS freelancer_id, 
        u.first_name || ' ' || u.last_name AS freelancer_name, 
        fs.total_earned, 
        fs.average_rating, 
        fs.completed_projects_count, 
        COUNT(p.id) AS active_projects_count, 
        SUM(p.bid_amount) AS potential_revenue, 
        fp.available, 
        fp.experience_years 
      FROM "Freelancer_profile" fp 
      JOIN users u ON fp.user_id = u.id 
      JOIN freelancer_stats fs ON fp.id = fs.freelancer_id 
      LEFT JOIN proposals p ON fp.id = p.freelancer_id 
      LEFT JOIN "Project_freelancer" pf ON p.id = pf.proposal_id 
      WHERE fp.available = true 
      GROUP BY fp.id, u.first_name, u.last_name, fs.total_earned, fs.average_rating, fs.completed_projects_count, fp.available, fp.experience_years 
      ORDER BY potential_revenue DESC, fs.average_rating DESC 
      LIMIT 50
    `;
    
    try {
      const result = await DatabaseConnectionService.executeQuery(connectionString, dbType, actualQuery);
      console.log('Actual query result count:', result.length);
      console.log('First few results:', result.slice(0, 3));
      console.log('Result structure:', result.length > 0 ? Object.keys(result[0]) : 'No results');
    } catch (error) {
      console.log('Actual query failed:', error.message);
    }
    
    // Test 3: Check simpler version of the query
    console.log('\n3. Testing simpler query...');
    const simpleQuery = `
      SELECT 
        fp.id AS freelancer_id, 
        u.first_name || ' ' || u.last_name AS freelancer_name, 
        fs.total_earned, 
        fs.average_rating, 
        fs.completed_projects_count
      FROM "Freelancer_profile" fp 
      JOIN users u ON fp.user_id = u.id 
      JOIN freelancer_stats fs ON fp.id = fs.freelancer_id 
      LIMIT 5
    `;
    
    try {
      const result = await DatabaseConnectionService.executeQuery(connectionString, dbType, simpleQuery);
      console.log('Simple query result count:', result.length);
      console.log('First few results:', result.slice(0, 3));
    } catch (error) {
      console.log('Simple query failed:', error.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testDatabaseData().catch(console.error); 