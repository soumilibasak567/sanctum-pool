// Vanilla-JS equivalent of the requested useWallet() React hook. Since this app
// has no React, the same state + actions live in a small observable store:
// createWalletStore() returns { getState, subscribe, connect, disconnect,
// refreshBalance, sendXlm }. A UI subscribes and re-renders on change.
import {
  detectFreighter,
  connectWallet,
  getWalletAddress,
  signTx,
} from "./stellar-wallet.js";
import {
  fetchXlmBalance,
  buildPaymentXdr,
  submitSignedTx,
} from "./stellar-sdk.js";

export function createWalletStore() {
  /** @type {{ address: string|null, balance: string|null, isConnected: boolean, isLoading: boolean, error: string|null }} */
  let state = {
    address: null,
    balance: null,
    isConnected: false,
    isLoading: false,
    error: null,
  };
  const listeners = new Set();

  const getState = () => state;
  function set(patch) {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn(state));
  }
  function subscribe(fn) {
    listeners.add(fn);
    fn(state);
    return () => listeners.delete(fn);
  }

  const message = (e) => (e && e.message ? e.message : String(e));

  async function refreshBalance() {
    if (!state.address) return;
    set({ isLoading: true, error: null });
    try {
      const balance = await fetchXlmBalance(state.address);
      set({ balance, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: message(e) });
    }
  }

  async function connect() {
    set({ isLoading: true, error: null });
    try {
      const installed = await detectFreighter();
      if (!installed) throw new Error("Freighter extension not detected");
      const address = await connectWallet();
      set({ address, isConnected: true, isLoading: false });
      await refreshBalance();
    } catch (e) {
      set({ isLoading: false, error: message(e) });
    }
  }

  function disconnect() {
    // Local state only — Freighter has no programmatic disconnect for a page.
    set({
      address: null,
      balance: null,
      isConnected: false,
      error: null,
    });
  }

  // Restore an already-granted session on load without prompting.
  async function restore() {
    try {
      const address = await getWalletAddress();
      if (address) {
        set({ address, isConnected: true });
        await refreshBalance();
      }
    } catch {
      /* no-op: nothing to restore */
    }
  }

  async function sendXlm(to, amount) {
    if (!state.address) throw new Error("Wallet not connected");
    set({ isLoading: true, error: null });
    try {
      const xdr = await buildPaymentXdr(state.address, to, amount);
      const signedXdr = await signTx(xdr);
      const { hash } = await submitSignedTx(signedXdr);
      set({ isLoading: false });
      // Reflect the new balance after a successful send.
      refreshBalance();
      return { hash };
    } catch (e) {
      set({ isLoading: false, error: message(e) });
      throw e;
    }
  }

  return {
    getState,
    subscribe,
    connect,
    disconnect,
    restore,
    refreshBalance,
    sendXlm,
  };
}
