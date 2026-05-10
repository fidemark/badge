// jsdom does not expose Node's WebCrypto SubtleCrypto on the window/global
// it constructs. Patch it on so hashRegion can call crypto.subtle.digest.
import { webcrypto } from "node:crypto";

if (!globalThis.crypto || !(globalThis.crypto as { subtle?: SubtleCrypto }).subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}
