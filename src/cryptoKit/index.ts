/**
 * Crypto functions to speed up development
 * with the WebCrypto API
 */

/**
 * Generate a random string of `numBytes` bytes
 * @param numBytes number of random bytes to generate
 * @returns hexadecimal string
 */
function generateRandomHexString(numBytes: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(numBytes));
  const array = Array.from(bytes);
  const hexPairs = array.map((b) => b.toString(16).padStart(2, '0'));
  return hexPairs.join('');
}
/**
 * Async function used to generate SHA-256 HMAC tokens across
 * the package's modules (heavily used for the CDN).
 * @param key
 * @param data
 * @returns
 */
async function generateSha256Hmac(key: Uint8Array, data: any): Promise<string> {
  const hmacKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

  const encodedData = new TextEncoder().encode(data);
  const signature = await crypto.subtle.sign('HMAC', hmacKey, encodedData);

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
/**
 * SHA-256 digest of any string
 * @param message
 * @returns
 */
async function hashSha256(message: string) {
  // encode as UTF-8
  const msgBuffer = new TextEncoder().encode(message);

  // hash the message
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);

  // convert ArrayBuffer to Array
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // convert bytes to hex string
  const hashHex = hashArray.map((b) => ('00' + b.toString(16)).slice(-2)).join('');
  console.log(hashHex);
  return hashHex;
}
/**
 * Generate a hash of a `ReadableStream`
 * @param body
 * @returns
 */
const hashReadableStreamSha256 = async (body: ReadableStream) => {
  const digestStream = new DigestStream('SHA-256');

  await body.pipeTo(digestStream);

  const digest = await digestStream.digest;

  const hexString = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');

  return hexString;
};

const digest = {
  hashReadableStreamSha256
};

export { hashSha256, generateRandomHexString, generateSha256Hmac, digest };
