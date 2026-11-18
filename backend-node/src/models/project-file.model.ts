import { Schema, Document, model, Model } from 'mongoose';

export interface IProjectFile extends Document {
  file_id: string;              // Standard UUIDv4, exposed to frontend as 'id'
  project_id: string;           // PostgreSQL Project UUID
  organization_id: string;      // PostgreSQL Organization UUID (hard tenant boundary)
  name: string;                 // Display filename (e.g., "Architecture_Plan.pdf")
  original_name: string;        // Original uploaded filename
  document_type: string;        // Normalized extension (e.g., "pdf", "png")
  mime_type: string;            // Validated MIME type (e.g., "application/pdf")
  file_size_bytes: number;      // Exact file size in bytes
  storage_provider: 'supabase' | 's3' | 'local';
  storage_key: string;          // Immutable object storage key
  checksum_sha256: string;      // Hex-encoded SHA-256 digest
  uploaded_by: string;          // PostgreSQL User UUID
  is_archived: boolean;         // Soft-delete / tombstone flag
  created_at: Date;
  updated_at: Date;
}

export const ProjectFileSchema = new Schema<IProjectFile>(
  {
    file_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    project_id: {
      type: String,
      required: true,
      index: true,
    },
    organization_id: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    original_name: {
      type: String,
      required: true,
    },
    document_type: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    mime_type: {
      type: String,
      required: true,
    },
    file_size_bytes: {
      type: Number,
      required: true,
      min: 0,
    },
    storage_provider: {
      type: String,
      enum: ['supabase', 's3', 'local'],
      default: 's3',
      required: true,
    },
    storage_key: {
      type: String,
      required: true,
      unique: true,
    },
    checksum_sha256: {
      type: String,
      required: true,
    },
    uploaded_by: {
      type: String,
      required: true,
    },
    is_archived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        // Expose file_id as id for 100% frontend contract compatibility
        ret.id = ret.file_id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret.file_id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Targeted, query-justified compound indexes
ProjectFileSchema.index({ project_id: 1, is_archived: 1, created_at: -1 });
ProjectFileSchema.index({ organization_id: 1, is_archived: 1, created_at: -1 });
ProjectFileSchema.index({ project_id: 1, name: 1 });

export const ProjectFile: Model<IProjectFile> =
  model<IProjectFile>('ProjectFile', ProjectFileSchema, 'project_files');
