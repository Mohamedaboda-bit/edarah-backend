const mysql = require('mysql2/promise');

async function debugMySQLSchema() {
  try {
    // Replace with your actual MySQL connection string
    const connectionString = 'mysql://username:password@localhost:3306/e-comm';
    
    const connection = await mysql.createConnection(connectionString);
    
    console.log('Connected to MySQL database');
    
    // Test the schema query
    const query = `
      SELECT 
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        CASE WHEN pk.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END as is_primary_key,
        c.column_default
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
      WHERE c.table_schema = DATABASE() 
        AND c.table_name IN (
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
        )
      ORDER BY c.table_name, c.ordinal_position
    `;
    
    const [result] = await connection.execute(query);
    
    console.log('Raw query result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Test grouping
    const tableMap = new Map();
    
    for (const row of result) {
      const tableName = row.table_name;
      
      if (!tableMap.has(tableName)) {
        tableMap.set(tableName, {
          name: tableName,
          columns: []
        });
      }
      
      const table = tableMap.get(tableName);
      
      // Check if column already exists to avoid duplicates
      const columnExists = table.columns.some(col => col.name === row.column_name);
      if (!columnExists) {
        table.columns.push({
          name: row.column_name,
          type: row.data_type,
          isNullable: row.is_nullable === 'YES',
          isPrimaryKey: row.is_primary_key === 'YES' || row.is_primary_key === true,
          defaultValue: row.column_default
        });
      }
    }
    
    const tables = Array.from(tableMap.values());
    
    console.log('\nProcessed tables:');
    console.log(JSON.stringify(tables, null, 2));
    
    await connection.end();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugMySQLSchema(); 