import apiService from './api.service';

export interface ServerTimeSnapshot {
  now: string;
  unixMs: number;
  storageTimeZone: 'UTC';
  displayTimeZone: 'Asia/Jakarta';
}

export interface ServerTimeResponse {
  success: boolean;
  message: string;
  data: ServerTimeSnapshot;
}

class ServerTimeService {
  async getCurrentTime(): Promise<ServerTimeSnapshot> {
    const response = await apiService.get<ServerTimeResponse>('/time');
    return response.data;
  }
}

export const serverTimeService = new ServerTimeService();
export default serverTimeService;
