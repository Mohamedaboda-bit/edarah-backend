import { Client } from 'pg';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import sql from 'mssql';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { EncryptionService } from './encryption';

export interface DatabaseSchema {
  tables: TableInfo[];
  databaseType: string;
  databaseName: string;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount?: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string;
  enumValues?: string[];
}

export interface ConnectionResult {
  success: boolean;
  data?: any;
  error?: string;
  schema?: DatabaseSchema;
}

export class DatabaseConnectionService {
  private static connections = new Map<string, any>();

  /**
   * Detect database type from connection string
   */
  static detectDatabaseType(connectionString: string): string {
    const lowerConnStr = connectionString.toLowerCase();
    
    if (lowerConnStr.includes('postgresql://') || lowerConnStr.includes('postgres://')) {
      return 'postgresql';
    } else if (lowerConnStr.includes('mysql://') || lowerConnStr.includes('mariadb://')) {
      return 'mysql';
    } else if (lowerConnStr.includes('mongodb://') || lowerConnStr.includes('mongodb+srv://')) {
      return 'mongodb';
    } else if (lowerConnStr.includes('mssql://') || lowerConnStr.includes('sqlserver://')) {
      return 'sqlserver';
    } else if (lowerConnStr.includes('sqlite://') || lowerConnStr.endsWith('.db') || lowerConnStr.endsWith('.sqlite')) {
      return 'sqlite';
    } else {
      throw new Error('Unsupported database type');
    }
  }

  /**
   * Extract database name from connection string
   */
  static extractDatabaseName(connectionString: string, dbType: string): string {
    try {
      switch (dbType) {
        case 'postgresql':
          const pgMatch = connectionString.match(/\/\/([^:]+:[^@]+@)?[^\/]+\/([^?]+)/);
          return pgMatch ? pgMatch[2] : 'unknown';
        
        case 'mysql':
          const mysqlMatch = connectionString.match(/\/\/([^:]+:[^@]+@)?[^\/]+\/([^?]+)/);
          return mysqlMatch ? mysqlMatch[2] : 'unknown';
        
        case 'mongodb':
          // Handle both formats: mongodb://user:pass@host:port/db and mongodb://host:port/db
          const mongoMatch = connectionString.match(/\/\/([^\/]+)\/([^?]+)/);
          return mongoMatch ? mongoMatch[2] : 'unknown';
        
        case 'sqlserver':
          const sqlMatch = connectionString.match(/Database=([^;]+)/);
          return sqlMatch ? sqlMatch[1] : 'unknown';
        
        case 'sqlite':
          const sqliteMatch = connectionString.match(/\/\/(.+)$/);
          return sqliteMatch ? sqliteMatch[1].split('/').pop()?.replace('.db', '').replace('.sqlite', '') || 'unknown' : 'unknown';
        
        default:
          return 'unknown';
      }
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Test database connection
   */
  static async testConnection(encryptedConnectionString: string, dbType: string): Promise<ConnectionResult> {
    try {
      const connectionString = EncryptionService.decrypt(encryptedConnectionString);
      const connection = await this.createConnection(connectionString, dbType);
      
      if (connection) {
        await this.closeConnection(connection, dbType);
        return { success: true };
      }
      
      return { success: false, error: 'Failed to establish connection' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection test failed' 
      };
    }
  }

  /**
   * Get database schema
   */
  static async getSchema(encryptedConnectionString: string, dbType: string): Promise<DatabaseSchema> {
    const connectionString = EncryptionService.decrypt(encryptedConnectionString);
    const databaseName = this.extractDatabaseName(connectionString, dbType);
    
    try {
      const connection = await this.createConnection(connectionString, dbType);
      const tables = await this.getTables(connection, dbType);
      await this.closeConnection(connection, dbType);
      
      return {
        tables,
        databaseType: dbType,
        databaseName
      };
    } catch (error) {
      throw new Error(`Failed to get schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute SQL query
   */
  static async executeQuery(encryptedConnectionString: string, dbType: string, query: string): Promise<any[]> {
    const connectionString = EncryptionService.decrypt(encryptedConnectionString);
    
    try {
      const connection = await this.createConnection(connectionString, dbType);
      const result = await this.runQuery(connection, dbType, query);
      await this.closeConnection(connection, dbType);
      
      return result;
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create database connection based on type
   */
  private static async createConnection(connectionString: string, dbType: string): Promise<any> {
    switch (dbType) {
      case 'postgresql':
        const pgClient = new Client({ connectionString });
        await pgClient.connect();
        return pgClient;
      
      case 'mysql':
        return await mysql.createConnection(connectionString);
      
      case 'mongodb':
        const mongoClient = new MongoClient(connectionString);
        await mongoClient.connect();
        return mongoClient;
      
      case 'sqlserver':
        return await sql.connect(connectionString);
      
      case 'sqlite':
        return await open({
          filename: connectionString.replace('sqlite://', ''),
          driver: sqlite3.Database
        });
      
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }

  /**
   * Close database connection
   */
  private static async closeConnection(connection: any, dbType: string): Promise<void> {
    try {
      switch (dbType) {
        case 'postgresql':
          await connection.end();
          break;
        case 'mysql':
          await connection.end();
          break;
        case 'mongodb':
          await connection.close();
          break;
        case 'sqlserver':
          await connection.close();
          break;
        case 'sqlite':
          await connection.close();
          break;
      }
    } catch (error) {
      console.error('Error closing connection:', error);
    }
  }

  /**
   * Get tables from database
   */
  private static async getTables(connection: any, dbType: string): Promise<TableInfo[]> {
    switch (dbType) {
      case 'postgresql':
        return await this.getPostgreSQLTables(connection);
      case 'mysql':
        return await this.getMySQLTables(connection);
      case 'mongodb':
        return await this.getMongoDBCollections(connection);
      case 'sqlserver':
        return await this.getSQLServerTables(connection);
      case 'sqlite':
        return await this.getSQLiteTables(connection);
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }

  /**
   * Execute query based on database type
   */
  private static async runQuery(connection: any, dbType: string, query: string): Promise<any[]> {
    switch (dbType) {
      case 'postgresql':
        const pgResult = await connection.query(query);
        return pgResult.rows;
      
      case 'mysql':
        const [mysqlResult] = await connection.execute(query);
        return mysqlResult;
      
      case 'mongodb':
        // Parse and execute MongoDB aggregation pipeline
        return await this.executeMongoDBQuery(connection, query);
      
      case 'sqlserver':
        const sqlResult = await connection.request().query(query);
        return sqlResult.recordset;
      
      case 'sqlite':
        const sqliteResult = await connection.all(query);
        return sqliteResult;
      
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }

  // Database-specific table retrieval methods
  private static async getPostgreSQLTables(connection: Client): Promise<TableInfo[]> {
    const query = `
      SELECT 
        t.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
        c.column_default,
        c.udt_name
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      LEFT JOIN (
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk ON t.table_name = pk.table_name AND c.column_name = pk.column_name
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name, c.ordinal_position
    `;
    
    const result = await connection.query(query);
    const tableInfos = this.groupColumnsByTable(result.rows);
    
    // Enhance enum columns with their values
    for (const table of tableInfos) {
      for (const column of table.columns) {
        if (column.type === 'USER-DEFINED') {
          // Get enum values for this column
          const enumValues = await this.getPostgreSQLEnumValues(connection, column.name);
          column.enumValues = enumValues;
        }
      }
    }
    
    return tableInfos;
  }

  /**
   * Get enum values for a PostgreSQL enum type
   */
  private static async getPostgreSQLEnumValues(connection: Client, columnName: string): Promise<string[]> {
    try {
      // Query to get enum values for a specific column
      const query = `
        SELECT 
          e.enumlabel as enum_value
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        JOIN pg_attribute a ON a.atttypid = t.oid
        JOIN pg_class c ON a.attrelid = c.oid
        WHERE a.attname = $1
        ORDER BY e.enumsortorder
      `;
      
      const result = await connection.query(query, [columnName]);
      return result.rows.map(row => row.enum_value);
    } catch (error) {
      console.error(`Failed to get enum values for column ${columnName}:`, error);
      return [];
    }
  }

  private static async getMySQLTables(connection: mysql.Connection): Promise<TableInfo[]> {
    // First, get all tables
    const tablesQuery = `
      SELECT TABLE_NAME as table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const [tablesResult] = await connection.execute(tablesQuery);
    const tables = (tablesResult as any[]).map(row => row.table_name).filter(name => name != null);
    
    // console.log('Found tables:', tables);
    
    const tableInfos: TableInfo[] = [];
    
    for (const tableName of tables) {
      if (!tableName) continue; // Skip undefined/null table names
      
      // Get columns for each table
      const columnsQuery = `
        SELECT 
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          IS_NULLABLE as is_nullable,
          COLUMN_DEFAULT as column_default,
          COLUMN_KEY as column_key
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() AND table_name = ?
        ORDER BY ordinal_position
      `;
      
      const [columnsResult] = await connection.execute(columnsQuery, [tableName]);
      const columns = (columnsResult as any[]).map(col => ({
        name: col.column_name,
        type: col.data_type,
        isNullable: col.is_nullable === 'YES',
        isPrimaryKey: col.column_key === 'PRI',
        defaultValue: col.column_default
      }));
      
      // console.log(`Table ${tableName} has ${columns.length} columns:`, columns.map(c => c.name));
      
      tableInfos.push({
        name: tableName,
        columns: columns
      });
    }
    
    return tableInfos;
  }

  private static async getMongoDBCollections(connection: MongoClient): Promise<TableInfo[]> {
    const db = connection.db();
    const collections = await db.listCollections().toArray();
    
    return collections.map(collection => ({
      name: collection.name,
      columns: [
        { name: '_id', type: 'ObjectId', isNullable: false, isPrimaryKey: true },
        { name: 'document', type: 'JSON', isNullable: true, isPrimaryKey: false }
      ]
    }));
  }

  /**
   * Execute MongoDB aggregation pipeline
   */
  private static async executeMongoDBQuery(connection: MongoClient, query: string): Promise<any[]> {
    try {
      console.log('Processing MongoDB query:', query);
      
      // Parse the query to extract collection name and pipeline
      const queryMatch = query.match(/db\.(\w+)\.aggregate\(\[(.*?)\]\)/s);
      if (!queryMatch) {
        throw new Error('Invalid MongoDB aggregation query format. Expected: db.collectionName.aggregate([...])');
      }

      const collectionName = queryMatch[1];
      const pipelineStr = queryMatch[2];
      
      console.log('Collection name:', collectionName);
      console.log('Pipeline string:', pipelineStr);

      // Parse the aggregation pipeline with more robust handling
      let pipeline;
      try {
        // Clean up the pipeline string
        let normalizedPipeline = pipelineStr
          .trim()
          .replace(/'/g, '"') // Replace single quotes with double quotes
          .replace(/(\w+):/g, '"$1":') // Add quotes to property names
          .replace(/,\s*}/g, '}') // Remove trailing commas in objects
          .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
          .replace(/\s+/g, ' ') // Normalize whitespace
          .replace(/"\s*:/g, '":') // Remove spaces before colons
          .replace(/:\s*"/g, ':"') // Remove spaces after colons
          .replace(/,\s*}/g, '}') // Remove trailing commas again
          .replace(/,\s*]/g, ']'); // Remove trailing commas again

        // Handle special MongoDB operators that might not be properly quoted
        normalizedPipeline = normalizedPipeline
          .replace(/"\$(\w+)"/g, '"$$$1"') // Ensure $ operators are properly quoted
          .replace(/"(\w+)":/g, '"$1":'); // Ensure all property names are quoted

        console.log('Normalized pipeline:', normalizedPipeline);
        
        pipeline = JSON.parse(`[${normalizedPipeline}]`);
        console.log('Parsed pipeline:', JSON.stringify(pipeline, null, 2));
      } catch (parseError) {
        console.error('Pipeline parsing error:', parseError);
        console.error('Original pipeline string:', pipelineStr);
        
        // Try a more lenient approach - use eval (only for trusted input)
        try {
          // This is a fallback for complex MongoDB syntax that JSON.parse can't handle
          const pipelineCode = `[${pipelineStr}]`;
          pipeline = eval(pipelineCode);
          console.log('Fallback parsing successful');
        } catch (evalError) {
          throw new Error(`Failed to parse MongoDB aggregation pipeline: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Pipeline: ${pipelineStr}`);
        }
      }

      const db = connection.db();
      const collection = db.collection(collectionName);
      
      console.log('Executing aggregation on collection:', collectionName);
      const result = await collection.aggregate(pipeline).toArray();
      console.log('Aggregation result count:', result.length);
      
      return result;
    } catch (error) {
      console.error('MongoDB query execution error:', error);
      throw new Error(`MongoDB query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async getSQLServerTables(connection: sql.ConnectionPool): Promise<TableInfo[]> {
    const query = `
      SELECT 
        t.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        CASE WHEN pk.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END as is_primary_key,
        c.column_default
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      LEFT JOIN (
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk ON t.table_name = pk.table_name AND c.column_name = pk.column_name
      WHERE t.table_type = 'BASE TABLE'
      ORDER BY t.table_name, c.ordinal_position
    `;
    
    const result = await connection.request().query(query);
    return this.groupColumnsByTable(result.recordset);
  }

  private static async getSQLiteTables(connection: any): Promise<TableInfo[]> {
    const tablesQuery = "SELECT name FROM sqlite_master WHERE type='table'";
    const tables = await connection.all(tablesQuery);
    
    const tableInfos: TableInfo[] = [];
    
    for (const table of tables) {
      const columnsQuery = `PRAGMA table_info(${table.name})`;
      const columns = await connection.all(columnsQuery);
      
      tableInfos.push({
        name: table.name,
        columns: columns.map((col: any) => ({
          name: col.name,
          type: col.type,
          isNullable: col.notnull === 0,
          isPrimaryKey: col.pk === 1,
          defaultValue: col.dflt_value
        }))
      });
    }
    
    return tableInfos;
  }

  /**
   * Group columns by table name
   */
  private static groupColumnsByTable(rows: any[]): TableInfo[] {
    const tableMap = new Map<string, TableInfo>();
    
    for (const row of rows) {
      const tableName = row.table_name;
      
      if (!tableMap.has(tableName)) {
        tableMap.set(tableName, {
          name: tableName,
          columns: []
        });
      }
      
      const table = tableMap.get(tableName)!;
      
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
    
    return Array.from(tableMap.values());
  }
} 