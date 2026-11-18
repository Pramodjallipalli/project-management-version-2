import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class StorageService {
  private static supabaseClient: SupabaseClient | null = null;
  private static supabaseBucket: string = '';

  static getSupabaseBucket(): string {
    return (process.env.SUPABASE_BUCKET || 'bug-attachments').trim();
  }

  static isSupabaseConfigured(): boolean {
    return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  }

  static isSupabaseKey(storageKey: string): boolean {
    return typeof storageKey === 'string' && storageKey.startsWith('supabase://');
  }

  private static getSupabaseClient(): SupabaseClient {
    if (!this.isSupabaseConfigured()) {
      throw new Error('Supabase Storage is not configured');
    }

    if (!this.supabaseClient) {
      this.supabaseBucket = this.getSupabaseBucket();
      this.supabaseClient = createClient(
        process.env.SUPABASE_URL!.trim(),
        process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
        {
          auth: { persistSession: false, autoRefreshToken: false },
        }
      );
    }

    return this.supabaseClient;
  }

  static parseSupabaseKey(storageKey: string): { bucket: string; objectPath: string } {
    if (!this.isSupabaseKey(storageKey)) {
      throw new Error('Invalid Supabase storage key');
    }

    const match = storageKey.match(/^supabase:\/\/([^/]+)\/(.+)$/);
    if (!match) {
      throw new Error('Invalid Supabase storage key format');
    }

    const bucket = match[1];
    const objectPath = match[2];
    if (objectPath.includes('..') || objectPath.split('/').some((part) => part === '.' || part === '')) {
      throw new Error('Invalid Supabase storage key: path traversal detected');
    }
    return { bucket, objectPath };
  }

  static async downloadSupabaseFile(storageKey: string): Promise<{ buffer: Buffer; mimeType: string; size: number }> {
    const { bucket, objectPath } = this.parseSupabaseKey(storageKey);
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);

    if (error) {
      const missing = error.message?.toLowerCase().includes('not found');
      const err = new Error(missing ? 'File not found in Supabase Storage' : 'Unable to download file from Supabase Storage');
      (err as any).statusCode = missing ? 404 : 502;
      throw err;
    }

    if (!data) {
      const err = new Error('File not found in Supabase Storage');
      (err as any).statusCode = 404;
      throw err;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    return {
      buffer,
      mimeType: data.type || this.getMimeType(objectPath),
      size: buffer.length,
    };
  }

  static getStorageRoot(): string {
    if (process.env.STORAGE_PATH) {
      const root = path.resolve(process.env.STORAGE_PATH);
      if (!fs.existsSync(root)) {
        fs.mkdirSync(root, { recursive: true });
      }
      return root;
    }

    // In serverless environments (e.g. Vercel, AWS Lambda), process.cwd() (/var/task) is read-only.
    // The only writable directory on the container is os.tmpdir() (/tmp).
    const isServerless = Boolean(
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      (typeof process.cwd === 'function' && process.cwd().startsWith('/var/task'))
    );

    const preferredRoot = isServerless
      ? path.join(os.tmpdir(), 'internhub-storage')
      : path.join(process.cwd(), 'storage');

    try {
      if (!fs.existsSync(preferredRoot)) {
        fs.mkdirSync(preferredRoot, { recursive: true });
      }
      return path.resolve(preferredRoot);
    } catch {
      const fallbackRoot = path.join(os.tmpdir(), 'internhub-storage');
      if (!fs.existsSync(fallbackRoot)) {
        fs.mkdirSync(fallbackRoot, { recursive: true });
      }
      return path.resolve(fallbackRoot);
    }
  }

  /**
   * Save a project document file into persistent storage
   */
  static async saveProjectFile(
    projectId: string,
    originalName: string,
    buffer: Buffer,
    declaredMimeType?: string
  ): Promise<{ storageKey: string; filename: string }> {
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
      throw new Error('Invalid projectId format');
    }
    if (!buffer || buffer.length === 0) {
      throw new Error('Valid file buffer is required');
    }
    if (buffer.length > 50 * 1024 * 1024) {
      throw new Error('File exceeds 50MB limit');
    }

    const ext = path.extname(originalName || '').replace(/^\./, '').toLowerCase();
    const blockedExtensions = new Set(['exe', 'bat', 'cmd', 'sh', 'vbs', 'ps1', 'jar', 'scr', 'com', 'msi', 'pif', 'hta', 'cpl', 'js']);
    if (blockedExtensions.has(ext)) {
      throw new Error(`File type '.${ext}' is prohibited for security reasons`);
    }

    const basename = path.basename(originalName || 'unnamed', ext ? `.${ext}` : '');
    const baseName = basename.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    const uniqueId = crypto.randomUUID();
    const generatedFilename = `${uniqueId}-${baseName}${ext ? `.${ext}` : ''}`;

    if (!this.isSupabaseConfigured()) {
      throw new Error('Supabase Storage is not configured (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required)');
    }

    const bucket = this.getSupabaseBucket();
    const objectPath = `projects/${projectId}/${generatedFilename}`;
    const supabase = this.getSupabaseClient();
    const mimeType = declaredMimeType || this.getMimeType(generatedFilename);
    const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    return {
      storageKey: `supabase://${bucket}/${objectPath}`,
      filename: generatedFilename,
    };
  }

  /**
   * Resolve physical file path from storage key
   */
  static getFilePath(storageKey: string, checkExists: boolean = true): string {
    const storageRoot = this.getStorageRoot();
    const resolvedPath = path.resolve(path.join(storageRoot, storageKey));

    if (!resolvedPath.startsWith(storageRoot)) {
      throw new Error('Invalid file path traversal');
    }

    if (checkExists && !fs.existsSync(resolvedPath)) {
      throw new Error('File not found in storage');
    }

    return resolvedPath;
  }

  /**
   * Delete a file from storage if it exists
   */
  static async deleteFile(storageKey: string): Promise<void> {
    if (!storageKey || typeof storageKey !== 'string') return;
    if (this.isSupabaseKey(storageKey)) {
      try {
        const { bucket, objectPath } = this.parseSupabaseKey(storageKey);
        const supabase = this.getSupabaseClient();
        await supabase.storage.from(bucket).remove([objectPath]);
      } catch {
        // Preserve idempotent deletion behavior; no local fallback for remote objects.
      }
      return;
    }
    try {
      const filePath = this.getFilePath(storageKey, false);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (e) {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Get standard MIME type from filename/extension
   */
  static getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.zip': 'application/zip',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }
}
