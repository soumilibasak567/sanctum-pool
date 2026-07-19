// Freighter wallet layer (Level 1). Thin, explicit wrappers around
// @stellar/freighter-api so the rest of the app never touches the raw
// extension API. Every call targets Stellar TESTNET.
import {
  isConnected,
  isAllowed,
  requestAccess,
  getAddress,
  signTransaction,
} from "@stellar/freighter-api";

export const STELLAR_TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const HORIZON_TESTNET_URL = "https://horizon-testnet.stellar.org";
export const FREIGHTER_INSTALL_URL = "https://freighter.app";

// freighter-api v6 returns { <value>, error? } from every call. Throw on the
// error field so callers can rely on plain try/catch.
function unwrap(res, field) {
  if (res && res.error) {
    throw new Error(res.error.message || String(res.error));
  }
  return res ? res[field] : undefined;
}

// True when the Freighter extension is installed / reachable.
export async function detectFreighter() {
  try {
    const res = await isConnected();
    return Boolean(unwrap(res, "isConnected"));
  } catch {
    return false;
  }
}

// Request permission (if not already granted) and return the G-address.
export async function connectWallet() {
  const allowed = await isAllowed().then((r) => unwrap(r, "isAllowed"));
  if (allowed) {
    const existing = await getAddress().then((r) => unwrap(r, "address"));
    if (existing) return existing;
  }
  // Prompts the user in the extension; returns the granted address.
  const address = await requestAccess().then((r) => unwrap(r, "address"));
  if (!address) throw new Error("No address returned by Freighter");
  return address;
}

// Current address if access was already granted, otherwise null (no prompt).
export async function getWalletAddress() {
  try {
    const allowed = await isAllowed().then((r) => unwrap(r, "isAllowed"));
    if (!allowed) return null;
    const address = await getAddress().then((r) => unwrap(r, "address"));
    return address || null;
  } catch {
    return null;
  }
}

// Sign a base64 transaction XDR with the testnet passphrase; returns signed XDR.
export async function signTx(xdr) {
  const res = await signTransaction(xdr, {
    networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
  });
  const signed = unwrap(res, "signedTxXdr");
  if (!signed) throw new Error("Freighter did not return a signed transaction");
  return signed;
}
