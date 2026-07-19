// Deployed testnet contracts + pool parameters. Update after redeploying
// (see deployments/). The ASP root watcher/operator posts state + ASP roots.
export const CONFIG = {
  verifier: "CAHBSVRPU4QRWPAUERYHEVOLL376Y7V4HPMQ6XNYF527ZLQD2NTEGNUZ",
  pool: "CDX247NWHXG466ZUAH7DMTRZZMQ5UMX5IB3PIPDHDMNXKUBTDV7FBUVG",
  token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", // native XLM SAC (testnet)
  denomAmount: 1000000n, // stroops moved per note (0.1 XLM)
  denomLabel: "0.1 XLM",
  scope: 1n,
  explorerTx: (h) => `https://stellar.expert/explorer/testnet/tx/${h}`,
};
