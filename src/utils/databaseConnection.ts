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
        // For MongoDB, we'll need to parse the query differently
        // This is a simplified version - you might want to implement MongoDB query parsing
        throw new Error('MongoDB query execution not yet implemented');
      
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
        c.column_default
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
    return this.groupColumnsByTable(result.rows);
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