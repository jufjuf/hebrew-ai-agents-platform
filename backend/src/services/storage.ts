import * as Minio from 'minio';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';

// Create MinIO client
export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'hebrew-ai-storage';

/**
 * Initialize MinIO and create bucket if not exists
 */
export async function initializeMinIO(): Promise<void> {
  try {
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
    
    if (!bucketExists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      logger.info(`✅ MinIO bucket '${BUCKET_NAME}' created`);
      
      // Set bucket policy for public read access to certain paths
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/public/*`],
          },
        ],
      };
      
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
    } else {
      logger.info(`✅ MinIO bucket '${BUCKET_NAME}' already exists`);
    }
    
    // Test connection
    await minioClient.listBuckets();
    logger.info('✅ MinIO connection verified');
  } catch (error) {
    logger.error('❌ MinIO initialization failed:', error);
    throw error;
  }
}

/**
 * Storage utilities
 */
export const storage = {
  /**
   * Upload file to MinIO
   */
  async uploadFile(
    file: Buffer | Readable,
    fileName: string,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    try {
      const objectName = `${uuidv4()}-${fileName}`;
      const metaData = {
        'Content-Type': mimeType,
        ...metadata,
      };

      await minioClient.putObject(BUCKET_NAME, objectName, file, metaData);
      
      logger.info(`File uploaded: ${objectName}`);
      return objectName;
    } catch (error) {
      logger.error('File upload error:', error);
      throw error;
    }
  },

  /**
   * Get file from MinIO
   */
  async getFile(objectName: string): Promise<Buffer> {
    try {
      const chunks: Buffer[] = [];
      const stream = await minioClient.getObject(BUCKET_NAME, objectName);
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error(`File get error for ${objectName}:`, error);
      throw error;
    }
  },

  /**
   * Get file stream from MinIO
   */
  async getFileStream(objectName: string): Promise<Readable> {
    try {
      return await minioClient.getObject(BUCKET_NAME, objectName);
    } catch (error) {
      logger.error(`File stream error for ${objectName}:`, error);
      throw error;
    }
  },

  /**
   * Delete file from MinIO
   */
  async deleteFile(objectName: string): Promise<void> {
    try {
      await minioClient.removeObject(BUCKET_NAME, objectName);
      logger.info(`File deleted: ${objectName}`);
    } catch (error) {
      logger.error(`File delete error for ${objectName}:`, error);
      throw error;
    }
  },

  /**
   * Get presigned URL for file upload
   */
  async getUploadUrl(
    fileName: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const objectName = `uploads/${uuidv4()}-${fileName}`;
      return await minioClient.presignedPutObject(
        BUCKET_NAME,
        objectName,
        expiresIn
      );
    } catch (error) {
      logger.error('Presigned URL generation error:', error);
      throw error;
    }
  },

  /**
   * Get presigned URL for file download
   */
  async getDownloadUrl(
    objectName: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      return await minioClient.presignedGetObject(
        BUCKET_NAME,
        objectName,
        expiresIn
      );
    } catch (error) {
      logger.error(`Download URL error for ${objectName}:`, error);
      throw error;
    }
  },

  /**
   * List files with prefix
   */
  async listFiles(prefix: string): Promise<Minio.BucketItem[]> {
    try {
      const files: Minio.BucketItem[] = [];
      const stream = minioClient.listObjects(BUCKET_NAME, prefix, true);
      
      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => files.push(obj));
        stream.on('end', () => resolve(files));
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error(`List files error for prefix ${prefix}:`, error);
      throw error;
    }
  },

  /**
   * Copy file
   */
  async copyFile(source: string, destination: string): Promise<void> {
    try {
      await minioClient.copyObject(
        BUCKET_NAME,
        destination,
        `/${BUCKET_NAME}/${source}`
      );
      logger.info(`File copied from ${source} to ${destination}`);
    } catch (error) {
      logger.error(`File copy error:`, error);
      throw error;
    }
  },
};