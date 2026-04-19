const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  database: process.env.DB_NAME || 'sipena_db_local',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

async function testDatabaseConnection() {
  let connection;

  try {
    console.log('🔄 Testing MySQL database connection...');
    console.log('📊 Config:', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
    });

    // Create connection
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully!');

    // Test basic query
    const [rows] = await connection.execute(
      'SELECT VERSION() as version, CURRENT_TIMESTAMP as now'
    );

    console.log('📋 Database Info:', {
      version: rows[0].version,
      timestamp: rows[0].now,
    });
  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error('Error:', error.message);

    // Tips cepat kalau gagal login/akses
    if (error.code) console.error('Code:', error.code);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Connection closed.');
    }
  }
}

// Run
testDatabaseConnection();
