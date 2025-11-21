"use client";

import { useEffect, useState } from "react";

const RPC_URL = "https://mainnet.base.org";

function toGwei(hex: string): number {
  return Number(BigInt(hex) / BigInt(1e9));
}

export default function Dashboard() {
  const [gasPrice, setGasPrice] = useState<number | null>(null);
  const [blobFee, setBlobFee] = useState<number | null>(null);
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [cached, setCached] = useState<boolean>(false);

  const loadCache = () => {
    const cachedGas = localStorage.getItem("gasPrice");
    const cachedBlob = localStorage.getItem("blobFee");
    const cachedBlock = localStorage.getItem("blockNumber");
    const cachedTime = localStorage.getItem("timestamp");
    if (cachedGas && cachedBlob && cachedBlock && cachedTime) {
      setGasPrice(Number(cachedGas));
      setBlobFee(Number(cachedBlob));
      setBlockNumber(Number(cachedBlock));
      setLastUpdated(Number(cachedTime));
      setCached(true);
    }
  };

  const saveCache = (gas: number, blob: number, block: number) => {
    localStorage.setItem("gasPrice", gas.toString());
    localStorage.setItem("blobFee", blob.toString());
    localStorage.setItem("blockNumber", block.toString());
    localStorage.setItem("timestamp", Date.now().toString());
  };

  const fetchData = async () => {
    try {
      const [gasRes, blockRes] = await Promise.all([
        fetch(RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_gasPrice",
            params: [],
            id: 1,
          }),
        }),
        fetch(RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getBlockByNumber",
            params: ["latest", false],
            id: 1,
          }),
        }),
      ]);

      const gasData = await gasRes.json();
      const blockData = await blockRes.json();

      const gas = toGwei(gasData.result);
      const block = Number(BigInt(blockData.result.number));
      const excessBlobGas = BigInt(blockData.result.excessBlobGas);
      const blobGasUsed = BigInt(blockData.result.blobGasUsed);
      const blob = Number((excessBlobGas + blobGasUsed) / BigInt(2) / BigInt(1e9));

      setGasPrice(gas);
      setBlobFee(blob);
      setBlockNumber(block);
      setLastUpdated(Date.now());
      setCached(false);
      saveCache(gas, blob, block);
    } catch {
      // keep cached values if fetch fails
    }
  };

  useEffect(() => {
    loadCache();
    fetchData();
    const interval = setInterval(fetchData, 12000);
    return () => clearInterval(interval);
  }, []);

  const age = lastUpdated ? Math.floor((Date.now() - lastUpdated) / 1000) : null;

  const gasColor =
    gasPrice !== null
      ? gasPrice < 0.05
        ? "text-green-400"
        : gasPrice < 0.2
        ? "text-yellow-400"
        : "text-red-400"
      : "";

  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4">Base Gas & Blob Fee Tracker</h1>
      <div className="space-y-2">
        <div>
          <span className="font-mono text-2xl mr-2">Legacy Gas Price:</span>
          <span className={gasColor}>{gasPrice !== null ? gasPrice.toFixed(3) : "—"} Gwei</span>
          {cached && <span className="ml-2 text-sm">(cached)</span>}
        </div>
        <div>
          <span className="font-mono text-2xl mr-2">Blob Base Fee:</span>
          <span>{blobFee !== null ? blobFee.toFixed(3) : "—"} Gwei</span>
          {cached && <span className="ml-2 text-sm">(cached)</span>}
        </div>
        <div>
          <span className="font-mono text-2xl mr-2">Block Number:</span>
          <span>{blockNumber !== null ? blockNumber : "—"}</span>
          {cached && <span className="ml-2 text-sm">(cached)</span>}
        </div>
        <div className="text-sm text-gray-400">
          {age !== null && <span>Last updated {age} seconds ago</span>}
        </div>
      </div>
      <button
        onClick={fetchData}
        className="mt-4 px-4 py-2 bg-gray-800 rounded hover:bg-gray-700"
      >
        Refresh Now
      </button>
    </div>
  );
}
