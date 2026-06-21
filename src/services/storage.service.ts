import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryResult {
  secure_url: string;
  public_id: string;
}

// Upload an in-memory file buffer to Cloudinary.
export function uploadBufferToCloudinary(
  buffer: Buffer,
  folder = 'lmvs'
): Promise<CloudinaryResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' }, // auto = handles images + PDFs
      (err, result) => {
        if (err || !result) return reject(err || new Error('Cloudinary upload failed'));
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

// Delete a file from Cloudinary by its public_id.
export function deleteFromCloudinary(publicId: string): Promise<any> {
  return cloudinary.uploader.destroy(publicId);
}