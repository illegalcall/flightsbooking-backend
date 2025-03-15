import * as cryptoBrowserify from 'crypto-browserify';
import * as uuid from 'uuid';

export function setupCryptoPolyfill(): void {
  if (!global.crypto) {
    global.crypto = cryptoBrowserify;
  }

  // Add randomUUID method to crypto
  if (global.crypto && !global.crypto.randomUUID) {
    global.crypto.randomUUID = function () {
      return uuid.v4() as `${string}-${string}-${string}-${string}-${string}`;
    };
  }
}
