import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getDatabaseClient } from '../client';

export abstract class BaseRepository {
  protected async queryRows<T extends RowDataPacket[]>(sql: string, params: unknown[] = []): Promise<T> {
    const [rows] = await getDatabaseClient().query<T>(sql, params);
    return rows;
  }

  protected async execute(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
    const [result] = await getDatabaseClient().query<ResultSetHeader>(sql, params);
    return result;
  }
}
