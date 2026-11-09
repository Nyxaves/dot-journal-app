import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

const CHUNK_SIZE = 1800;

/**
 * Supabase sessions are stored in Android Keystore-backed SecureStore.
 * Chunking keeps each native value comfortably below platform payload limits.
 */
const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const rawCount = await SecureStore.getItemAsync(`${key}.chunk-count`);
    if (!rawCount) return null;

    const count = Number(rawCount);
    if (!Number.isInteger(count) || count < 1 || count > 20) return null;

    const chunks: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const chunk = await SecureStore.getItemAsync(`${key}.chunk.${index}`);
      if (chunk === null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousCount = Number(
      (await SecureStore.getItemAsync(`${key}.chunk-count`)) ?? '0'
    );
    const chunks: string[] = [];
    for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
      chunks.push(value.slice(offset, offset + CHUNK_SIZE));
    }
    if (chunks.length === 0) chunks.push('');

    // Write all chunks first; publish the new count only after successful writes.
    for (let index = 0; index < chunks.length; index += 1) {
      await SecureStore.setItemAsync(`${key}.chunk.${index}`, chunks[index]);
    }
    await SecureStore.setItemAsync(`${key}.chunk-count`, String(chunks.length));

    for (let index = chunks.length; index < previousCount; index += 1) {
      await SecureStore.deleteItemAsync(`${key}.chunk.${index}`);
    }
  },

  async removeItem(key: string): Promise<void> {
    const count = Number(
      (await SecureStore.getItemAsync(`${key}.chunk-count`)) ?? '0'
    );
    await SecureStore.deleteItemAsync(`${key}.chunk-count`);
    if (Number.isInteger(count) && count > 0 && count <= 20) {
      for (let index = 0; index < count; index += 1) {
        await SecureStore.deleteItemAsync(`${key}.chunk.${index}`);
      }
    }
  },
};

let supabaseClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return (
    supabaseUrl.startsWith('https://') &&
    supabasePublishableKey.length > 20 &&
    !supabasePublishableKey.includes('SUBSTITUTE')
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        storage: secureSessionStorage,
        storageKey: 'dot-journal-personal-auth',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  }
  return supabaseClient;
}
