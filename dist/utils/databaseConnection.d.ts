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
export declare class DatabaseConnectionService {
    private static connections;
    /**
     * Detect database type from connection string
     */
    static detectDatabaseType(connectionString: string): string;
    /**
     * Extract database name from connection string
     */
    static extractDatabaseName(connectionString: string, dbType: string): string;
    /**
     * Test database connection
     */
    static testConnection(encryptedConnectionString: string, dbType: string): Promise<ConnectionResult>;
    /**
     * Get database schema
     */
    static getSchema(encryptedConnectionString: string, dbType: string): Promise<DatabaseSchema>;
    /**
     * Execute SQL query
     */
    static executeQuery(encryptedConnectionString: string, dbType: string, query: string): Promise<any[]>;
    /**
     * Create database connection based on type
     */
    private static createConnection;
    /**
     * Close database connection
     */
    private static closeConnection;
    /**
     * Get tables from database
     */
    private static getTables;
    /**
     * Execute query based on database type
     */
    private static runQuery;
    private static getPostgreSQLTables;
    /**
     * Get enum values for a PostgreSQL enum type
     */
    private static getPostgreSQLEnumValues;
    private static getMySQLTables;
    private static getMongoDBCollections;
    /**
     * Execute MongoDB aggregation pipeline
     */
    private static executeMongoDBQuery;
    private static getSQLServerTables;
    private static getSQLiteTables;
    /**
     * Group columns by table name
     */
    private static groupColumnsByTable;
}
//# sourceMappingURL=databaseConnection.d.ts.map