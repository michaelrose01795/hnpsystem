# VHC Customer Media Bucket Fix

## Problem
Customer video uploads were failing with "Bucket not found" error when the `vhc-customer-media` bucket didn't exist in Supabase Storage.

## Solution
Implemented automatic bucket creation and improved storage organization for VHC customer media.

### Changes Made

#### 1. New Utility Service: `src/lib/storage/vhcMediaBucketService.js`
- **Purpose**: Centralized management of VHC customer media bucket operations
- **Key Functions**:
  - `ensureVhcMediaBucket()` - Creates the bucket if it doesn't exist (runs once per process)
  - `uploadVhcMediaFile()` - Handles secure media file uploads
  - `buildVhcMediaStoragePath()` - Generates organized storage paths
  - `deleteVhcMediaFile()` - Safely removes media files

#### 2. Updated Endpoint: `src/pages/api/vhc/customer-video-upload.js`
- Now calls `ensureVhcMediaBucket()` before uploading
- Uses new organized storage structure via `uploadVhcMediaFile()`
- Improved error logging for debugging
- Storage path structure: `jobs/{jobNumber}/{mediaType}/{timestamp}-{fileName}`

### Storage Structure

Files are now organized by job number and media type:

```
vhc-customer-media bucket:
├── jobs/
│   ├── 12345/          (job number)
│   │   ├── customer-video/
│   │   │   ├── 1708923456000-video-1.webm
│   │   │   └── 1708923457000-video-2.webm
│   │   ├── photo/      (future use)
│   │   ├── video/      (future use)
│   │   └── document/   (future use)
│   └── 12346/
│       └── customer-video/
│           └── 1708923458000-video-1.webm
```

### Supported Media Types

The service defines these media types (expandable for future use):

```javascript
MEDIA_TYPES = {
  photo: "photo",
  video: "video",
  customerVideo: "customer-video",
  document: "document"
}
```

### How It Works

1. **First Upload**: When the first customer video is uploaded:
   - Checks if `vhc-customer-media` bucket exists
   - If not, creates it automatically (requires `SUPABASE_SERVICE_ROLE_KEY`)
   - Organizes file by job number and media type
   - Records metadata in `vhc_customer_media` database table

2. **Subsequent Uploads**: 
   - Bucket check is cached in memory (runs once per process)
   - Files are uploaded using the same organized structure
   - Different media types can coexist in the same folder structure

### Database Integration

Files are tracked in the `vhc_customer_media` table with:
- `job_number` - Job reference
- `media_type` - Type of media (video, photo, document, customer-video)
- `storage_bucket` - Bucket name (`vhc-customer-media`)
- `storage_path` - Full path to file in bucket
- `public_url` - Publicly accessible URL
- `mime_type` - File content type
- `file_size_bytes` - File size in bytes
- `overlays` - JSON array of applied overlays/widgets
- `context_label` - Optional VHC section label
- `uploaded_by` - ID of uploader
- `created_at` - Timestamp

### Error Handling

The system handles these scenarios:

1. **Missing Bucket** → Attempts to create it automatically
2. **Creation Fails** → Returns clear error message
3. **Service Role Not Configured** → Explains the issue and instructions
4. **Invalid File** → Returns clear validation errors
5. **Upload Failure** → Logs detailed error info for debugging

### Future Enhancements

The foundation is now in place to support:

1. **Photo uploads** - Use `MEDIA_TYPES.photo` when uploading photos
2. **Document uploads** - Use `MEDIA_TYPES.document` for PDFs, etc.
3. **Multiple media sources** - Each type maintains its own folder structure
4. **Batch operations** - Could be extended for bulk uploads

### Testing

To test the fix:

1. Delete the `vhc-customer-media` bucket from Supabase (if it exists)
2. Upload a customer video through the UI
3. The bucket should be created automatically
4. Video should upload successfully to `jobs/{jobNumber}/customer-video/`

### Environment Requirements

- `SUPABASE_SERVICE_ROLE_KEY` must be configured for bucket creation
- Bucket will be created with `public: true` (files require access token but bucket exists)
- 50 MB file size limit per file

### Maintenance

The bucket check is cached per process:
- First upload triggers the check/creation
- Subsequent uploads skip the check (cached promise)
- Works correctly in serverless environments (new process per request)
- Safe to deploy incrementally
