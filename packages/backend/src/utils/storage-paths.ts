import fs from 'fs';
import path from 'path';

const uploadsRoot = path.resolve(process.env.UPLOADS_ROOT || path.join(process.cwd(), 'uploads'));

const ensureDirectory = (directoryPath: string): string => {
  fs.mkdirSync(directoryPath, { recursive: true });
  return directoryPath;
};

export const getUploadsRootDir = (): string => ensureDirectory(uploadsRoot);

export const getProfileUploadsDir = (): string => ensureDirectory(path.join(getUploadsRootDir(), 'profiles'));

export const getReportUploadsDir = (): string => ensureDirectory(path.join(getUploadsRootDir(), 'reports'));
