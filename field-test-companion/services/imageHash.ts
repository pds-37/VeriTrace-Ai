import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Computes a SHA-256 hash of an image file using Expo Crypto.
 * Supports direct Base64 string from camera, local file URIs via FileSystem,
 * data URIs, and fetch/blob fallback.
 *
 * @param imageUri URI of the image file (e.g. file://... or data:...)
 * @param base64Data Optional pre-computed Base64 string from camera capture
 * @returns 64-character lowercase hexadecimal SHA-256 digest string
 */
export async function computeImageSha256Async(
  imageUri: string,
  base64Data?: string
): Promise<string> {
  try {
    // 1. If base64 string was provided by the camera, hash it directly
    if (base64Data && base64Data.length > 0) {
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        base64Data,
        { encoding: Crypto.CryptoEncoding.HEX }
      );
    }

    // 2. On native platforms, read the file as Base64 using Expo FileSystem
    if (Platform.OS !== 'web' && imageUri && (imageUri.startsWith('file:') || imageUri.startsWith('content:'))) {
      try {
        const fileBase64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (fileBase64 && fileBase64.length > 0) {
          return await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            fileBase64,
            { encoding: Crypto.CryptoEncoding.HEX }
          );
        }
      } catch (readError) {
        console.warn('FileSystem.readAsStringAsync failed, attempting fallback:', readError);
      }
    }

    // 3. If it's a data URI (common on web), extract payload and hash
    if (imageUri && imageUri.startsWith('data:')) {
      const parts = imageUri.split(',');
      const payload = parts.length > 1 ? parts[1] : parts[0];
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        payload,
        { encoding: Crypto.CryptoEncoding.HEX }
      );
    }

    // 4. Fallback for web or other URI schemes using fetch -> ArrayBuffer -> Crypto.digest
    if (imageUri) {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const digestBuffer = await Crypto.digest(
        Crypto.CryptoDigestAlgorithm.SHA256,
        arrayBuffer
      );
      const hashBytes = Array.from(new Uint8Array(digestBuffer));
      return hashBytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    return 'UNAVAILABLE';
  } catch (error) {
    console.error('Failed to compute image SHA-256 hash:', error);
    return 'UNAVAILABLE';
  }
}
