import fs from 'fs';
import path from 'path';

const resolveDefaultUploadsRoot = (): string => {
  if (process.env.UPLOADS_ROOT) {
    return process.env.UPLOADS_ROOT;
  }

  const railwayVolumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (railwayVolumePath) {
    return path.join(railwayVolumePath, 'uploads');
  }

  if (process.env.NODE_ENV === 'production' && fs.existsSync('/data')) {
    return '/data/uploads';
  }

  return path.join(process.cwd(), 'uploads');
};

const uploadsRoot = path.resolve(resolveDefaultUploadsRoot());

const ensureDirectory = (directoryPath: string): string => {
  fs.mkdirSync(directoryPath, { recursive: true });
  return directoryPath;
};

export const getUploadsRootDir = (): string => ensureDirectory(uploadsRoot);

export const getProfileUploadsDir = (): string => ensureDirectory(path.join(getUploadsRootDir(), 'profiles'));

export const getReportUploadsDir = (): string => ensureDirectory(path.join(getUploadsRootDir(), 'reports'));

export const getMaintenanceUploadsDir = (): string => ensureDirectory(path.join(getUploadsRootDir(), 'maintenance'));

export const getAnnouncementUploadsDir = (): string => ensureDirectory(path.join(getUploadsRootDir(), 'announcements'));
