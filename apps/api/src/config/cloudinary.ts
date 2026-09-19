import { v2 as cloudinary } from 'cloudinary';
import { env, isCloudinaryConfigured } from './env';

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: env.CLOUD_NAME || env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };

export async function connectStorage(): Promise<boolean> {
  if (!isCloudinaryConfigured()) {
    return false;
  }

  try {
    const result = await cloudinary.api.ping();
    return result.status === 'ok';
  } catch {
    return false;
  }
}
