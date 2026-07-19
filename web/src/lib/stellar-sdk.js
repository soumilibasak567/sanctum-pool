// Horizon / stellar-sdk helpers for the Level 1 wallet flow: read the native
// XLM balance, build an unsigned payment XDR, and submit a signed one.
import {
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import {
  HORIZON_TESTNET_URL,
  STELLAR_TESTNET_PASSPHRASE,
} from "./stellar-wallet.js";

const server = new Horizon.Server(HORIZON_TESTNET_URL);

// Returns the native (XLM) balance as a string, e.g. "12.5000000".
// An unfunded account (404 from Horizon) resolves to "0".
export async function fetchXlmBalance(address) {
  try {
    const account = await server.loadAccount(address);
    const native = account.balances.find((b) => b.asset_type === "native");
    return native ? native.balance : "0";
  } catch (e) {
    // Horizon returns 404 for accounts that have never been funded.
    if (e && (e.response?.status === 404 || e.name === "NotFoundError")) {
      return "0";
    }
    throw e;
  }
}

// Build an unsigned native-payment transaction and return it as base64 XDR.
export async function buildPaymentXdr(from, to, amount) {
  const account = await server.loadAccount(from);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: to,
        asset: Asset.native(),
        amount: String(amount),
      }),
    )
    .setTimeout(30)
    .build();
  return tx.toXDR();
}

// Submit a signed XDR to Horizon; returns the transaction hash. On failure,
// surface the most specific Horizon result code available.
export async function submitSignedTx(signedXdr) {
  const tx = TransactionBuilder.fromXDR(signedXdr, STELLAR_TESTNET_PASSPHRASE);
  try {
    const res = await server.submitTransaction(tx);
    return { hash: res.hash };
  } catch (e) {
    const extras = e?.response?.data?.extras;
    const codes = extras?.result_codes;
    if (codes) {
      const ops = Array.isArray(codes.operations)
        ? ` (${codes.operations.join(", ")})`
        : "";
      throw new Error(`${codes.transaction || "tx_failed"}${ops}`);
    }
    throw new Error(extras?.detail || e?.message || "Transaction submission failed");
  }
}
