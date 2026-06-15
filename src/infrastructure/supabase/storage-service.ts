import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'signatures';
const SIGNED_URL_EXPIRY = 3600;

export class SupabaseStorageService {
  constructor(private client: SupabaseClient) {}

  async uploadSignature(sessionId: string, file: Buffer, contentType: string): Promise<string> {
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `${sessionId}-${Date.now()}.${ext}`;

    const { error } = await this.client.storage
      .from(BUCKET)
      .upload(path, file, { contentType, upsert: true });

    if (error) throw new Error(error.message);
    return path;
  }

  async createSignedUrl(path: string): Promise<string | null> {
    const { data, error } = await this.client.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRY);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }

  async uploadMoradorSignature(moradorId: number, file: Buffer, contentType: string): Promise<string> {
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `morador-${moradorId}-${Date.now()}.${ext}`;

    const { error } = await this.client.storage
      .from(BUCKET)
      .upload(path, file, { contentType, upsert: true });

    if (error) throw new Error(error.message);
    return path;
  }

  // Deprecated: used by old API logic, should be replaced by createSignedUrl
  async getMoradorSignatureUrl(moradorId: number): Promise<string | null> {
    const extensions = ['jpg', 'png', 'webp'];
    for (const ext of extensions) {
      const path = `morador-${moradorId}.${ext}`;
      const { data } = await this.client.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_EXPIRY);
      if (data?.signedUrl) return data.signedUrl;
    }
    return null;
  }

  async getSignatureUrl(sessionId: string): Promise<string | null> {
    const extensions = ['jpg', 'png', 'webp'];
    for (const ext of extensions) {
      const path = `${sessionId}.${ext}`;
      const { data } = await this.client.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_EXPIRY);
      if (data?.signedUrl) return data.signedUrl;
    }
    return null;
  }
}
