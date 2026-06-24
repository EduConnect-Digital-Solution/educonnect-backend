const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const logger = require('../utils/logger');

let supabase = null;

const getClient = () => {
  if (!supabase) {
    if (!config.supabase.isConfigured) {
      logger.warn('Supabase storage not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env');
      return null;
    }
    supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false }
    });
  }
  return supabase;
};

const uploadPdf = async (buffer, { schoolId, termId, studentId, armId }) => {
  const client = getClient();
  if (!client) return null;

  const bucket = config.supabase.storageBucket;
  const fileName = `${schoolId}/${termId}/${armId || 'all'}/${studentId || 'batch'}_${Date.now()}.pdf`;

  const { data, error } = await client
    .storage
    .from(bucket)
    .upload(fileName, buffer, {
      contentType: 'application/pdf',
      upsert: false
    });

  if (error) {
    if (error.message?.includes('bucket') && error.message?.includes('not found')) {
      logger.info(`Bucket "${bucket}" not found. Attempting to create it...`);
      const { error: createError } = await client.storage.createBucket(bucket, {
        public: true,
        allowedMimeTypes: ['application/pdf']
      });
      if (createError) {
        logger.error('Failed to create storage bucket:', createError);
        return null;
      }
      // Retry upload
      const { data: retryData, error: retryError } = await client
        .storage.from(bucket)
        .upload(fileName, buffer, { contentType: 'application/pdf', upsert: false });
      if (retryError) {
        logger.error('Supabase upload failed after bucket creation:', retryError);
        return null;
      }
      const { data: urlData } = client.storage.from(bucket).getPublicUrl(fileName);
      logger.info(`PDF uploaded to Supabase: ${urlData.publicUrl}`);
      return urlData.publicUrl;
    }

    logger.error('Supabase upload failed:', error);
    return null;
  }

  const { data: urlData } = client.storage.from(bucket).getPublicUrl(fileName);
  logger.info(`PDF uploaded to Supabase: ${urlData.publicUrl}`);
  return urlData.publicUrl;
};

const isConfigured = () => config.supabase.isConfigured;

module.exports = { uploadPdf, isConfigured };
