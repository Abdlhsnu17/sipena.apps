/**
 * Database Transaction Utilities
 * Provides helper functions for managing database transactions safely
 */

import { Connection, PoolConnection, RowDataPacket } from 'mysql2/promise';

/**
 * Executes a callback within a database transaction
 * Automatically commits on success, rolls back on error
 *
 * @param connection - Database connection or pool
 * @param callback - Function to execute within transaction
 * @returns Result of the callback
 * @throws Error if transaction fails
 *
 * @example
 * ```typescript
 * const result = await withTransaction(pool, async (conn) => {
 *   const [result1] = await conn.execute('INSERT INTO table1 ...');
 *   const [result2] = await conn.execute('INSERT INTO table2 ...');
 *   return { result1, result2 };
 * });
 * ```
 */
export async function withTransaction<T>(
  connection: PoolConnection | Connection,
  callback: (connection: PoolConnection | Connection) => Promise<T>
): Promise<T> {
  try {
    // Start transaction
    await connection.beginTransaction();

    // Execute callback
    const result = await callback(connection);

    // Commit transaction
    await connection.commit();

    return result;
  } catch (error) {
    // Rollback on error
    await connection.rollback();
    throw error;
  }
}

/**
 * Executes a callback with row-level locking to prevent race conditions
 * Uses SELECT ... FOR UPDATE to lock rows during transaction
 *
 * @param connection - Database connection
 * @param tableName - Name of table containing the row to lock
 * @param whereClause - WHERE conditions to identify the row
 * @param whereParams - Parameters for WHERE clause
 * @param callback - Function to execute with row locked
 * @returns Result of callback
 *
 * @example
 * ```typescript
 * const result = await withRowLock(
 *   connection,
 *   'borrowing_records',
 *   'asset_id = ? AND status = ?',
 *   [assetId, 'pending'],
 *   async (conn, existingRows) => {
 *     if (existingRows.length > 0) {
 *       return { error: 'Asset is already borrowed' };
 *     }
 *     // Safe to insert now - row is locked
 *     const [result] = await conn.execute('INSERT INTO borrowing_records ...');
 *     return { success: true, insertId: result.insertId };
 *   }
 * );
 * ```
 */
export async function withRowLock<T>(
  connection: PoolConnection | Connection,
  tableName: string,
  whereClause: string,
  whereParams: any[],
  callback: (
    connection: PoolConnection | Connection,
    existingRows: any[]
  ) => Promise<T>
): Promise<T> {
  try {
    // Start transaction with row locking
    await connection.beginTransaction();

    // Lock the row(s) to prevent concurrent modifications
    const [existingRows] = await connection.execute<RowDataPacket[]>(
      `SELECT * FROM ${tableName} WHERE ${whereClause} FOR UPDATE`,
      whereParams
    );

    // Execute callback with locked rows
    const result = await callback(connection, existingRows);

    // Commit transaction
    await connection.commit();

    return result;
  } catch (error) {
    // Rollback on error
    await connection.rollback();
    throw error;
  }
}

/**
 * Executes a callback with a connection acquired from the pool
 * Automatically returns the connection to the pool
 *
 * @param pool - Database pool
 * @param callback - Function to execute with connection
 * @returns Result of callback
 *
 * @example
 * ```typescript
 * const result = await withConnection(pool, async (conn) => {
 *   const [rows] = await conn.execute('SELECT * FROM users');
 *   return rows;
 * });
 * ```
 */
export async function withConnection<T>(
  pool: any,
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    return await callback(connection);
  } finally {
    connection.release();
  }
}
