// Self-contained Freighter wallet panel (Level 1 demo surface). Follows the
// app's view/init convention: viewWalletPanel() returns markup, initWalletPanel()
// wires it to a wallet store and returns a teardown fn. Reuses the existing
// design-system classes (card / panel / inp / cta / field / tag).
import {
  detectFreighter,
  connectWallet,
  signTx,
  FREIGHTER_INSTALL_URL,
} from "./lib/stellar-wallet.js";
import { createWalletStore } from "./lib/wallet-store.js";
import { CONFIG } from "./config.js";

// Keep the explicit imports referenced so the panel documents its own
// dependencies even though the store orchestrates the actual flow.
void connectWallet;
void signTx;

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

export function viewWalletPanel() {
  return `
  <section class="panel" data-anim>
    <div class="card"><div class="card-pad">
      <div class="card-head"><h1>Stellar Wallet</h1><span class="tag">Freighter · Testnet</span></div>
      <p class="lead">Detect Freighter, connect your account, read your XLM balance, and send a testnet payment — the full path from wallet to confirmed transaction hash.</p>
      <div id="wp-body"></div>
    </div></div>
  </section>`;
}

export function initWalletPanel() {
  const store = createWalletStore();
  const body = document.getElementById("wp-body");
  if (!body) return () => {};

  let installed = true;
  let banner = null; // { kind: 'ok'|'err', html: string }

  function shortAddr(a) {
    return a ? `${a.slice(0, 6)}…${a.slice(-6)}` : "";
  }

  function render(state) {
    if (!installed) {
      body.innerHTML = `
        <div class="result bad">
          <div class="h"><span class="tick">✕</span> Freighter not detected</div>
        </div>
        <a class="cta" href="${FREIGHTER_INSTALL_URL}" target="_blank" rel="noopener" style="margin-top:14px">
          <span class="label">Install Freighter</span>
        </a>`;
      return;
    }

    if (!state.isConnected) {
      body.innerHTML = `
        <button class="cta" id="wp-connect" ${state.isLoading ? "disabled" : ""}>
          <span class="label">${state.isLoading ? "Connecting…" : "Connect Wallet"}</span>
        </button>
        ${state.error ? errBanner(state.error) : ""}`;
      document.getElementById("wp-connect").onclick = () => store.connect();
      return;
    }

    const bal = state.balance == null ? "…" : state.balance;
    const funded = state.balance !== "0";
    body.innerHTML = `
      <div class="info-rows">
        <div class="row"><span class="k">Address</span><span class="v" style="font-family:var(--mono,monospace)">${esc(shortAddr(state.address))}</span></div>
        <div class="row"><span class="k">Balance</span><span class="v acc">${esc(bal)} XLM${funded ? "" : " <small>(account not funded)</small>"}</span></div>
      </div>
      <div class="two mb16" style="margin-top:14px">
        <button class="cta" id="wp-refresh" ${state.isLoading ? "disabled" : ""}>
          <span class="label">${state.isLoading ? "…" : "Refresh Balance"}</span>
        </button>
        <button class="cta" id="wp-disconnect"><span class="label">Disconnect</span></button>
      </div>

      <div class="sel-label" style="margin-top:8px">Send XLM</div>
      <label class="field" for="wp-to">Destination address</label>
      <input class="inp mb16" id="wp-to" placeholder="G…" autocomplete="off" spellcheck="false" />
      <label class="field" for="wp-amount">Amount (XLM)</label>
      <input class="inp mb20" id="wp-amount" type="number" min="0" step="0.0000001" placeholder="1.0" />
      <button class="cta" id="wp-send" ${state.isLoading ? "disabled" : ""}>
        <span class="label">${state.isLoading ? "Sending…" : "Send XLM"}</span>
      </button>

      <div class="wp-full-address" style="margin-top:16px;word-break:break-all;font-family:var(--mono,monospace);opacity:.7;font-size:12px">${esc(state.address)}</div>
      ${banner ? renderBanner() : ""}
      ${state.error && !banner ? errBanner(state.error) : ""}`;

    document.getElementById("wp-refresh").onclick = () => store.refreshBalance();
    document.getElementById("wp-disconnect").onclick = () => {
      banner = null;
      store.disconnect();
    };
    document.getElementById("wp-send").onclick = onSend;
  }

  function errBanner(msg) {
    return `<div class="result bad" style="margin-top:14px"><div class="h"><span class="tick">✕</span> ${esc(msg)}</div></div>`;
  }

  function renderBanner() {
    if (banner.kind === "ok") {
      return `<div class="result" style="margin-top:14px"><div class="h"><span class="tick">✓</span> ${banner.html}</div></div>`;
    }
    return `<div class="result bad" style="margin-top:14px"><div class="h"><span class="tick">✕</span> ${banner.html}</div></div>`;
  }

  async function onSend() {
    const to = document.getElementById("wp-to").value.trim();
    const amount = document.getElementById("wp-amount").value.trim();
    banner = null;
    if (!to || !amount) {
      banner = { kind: "err", html: "Enter a destination address and amount." };
      render(store.getState());
      return;
    }
    try {
      const { hash } = await store.sendXlm(to, amount);
      const url = CONFIG.explorerTx(hash);
      banner = {
        kind: "ok",
        html: `Transaction sent! Hash: <a href="${url}" target="_blank" rel="noopener">${esc(hash.slice(0, 12))}…</a>`,
      };
    } catch (e) {
      banner = { kind: "err", html: esc(e?.message || String(e)) };
    }
    render(store.getState());
  }

  // Boot: detect the extension, restore any prior session, then subscribe.
  let unsub = () => {};
  detectFreighter().then((ok) => {
    installed = ok;
    if (!ok) {
      render(store.getState());
      return;
    }
    unsub = store.subscribe(render);
    store.restore();
  });

  return () => unsub();
}
