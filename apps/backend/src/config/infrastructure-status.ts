/**
 * Status infrastruktur yang dibagi antara bootstrap (`index.ts`, yang melakukan
 * koneksi) dan aplikasi Express (`app.ts`, yang melaporkannya lewat /health).
 *
 * Dipisah ke modul sendiri agar `app.ts` tetap bebas efek samping: membangun
 * aplikasi tidak boleh menyentuh database atau Redis.
 */
export type ServiceStatus = 'initializing' | 'up' | 'down';
export type OptionalServiceStatus = ServiceStatus | 'optional-down';

export interface InfrastructureStatus {
  database: ServiceStatus;
  redis: OptionalServiceStatus;
  schema: ServiceStatus;
}

export const infrastructureStatus: InfrastructureStatus = {
  database: 'initializing',
  redis: 'initializing',
  schema: 'initializing',
};
