



"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const RPC_URL = "https://mainnet.base.org";

function toGwei(hex: string): number {
  return Number(BigInt(hex) / BigInt(1e9));
}

type DataPoint = {
  gas: number;
  blob: number;
  block: number;
  timestamp: number;
};

export default function Dashboard() {
  const [history, setHistory] = useState<DataPoint[]>([]);
  const [gasPrice, setGasPrice] = useState<number | null>(null);
  const [blobFee, setBlobFee] = useState<number | null>(null);
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [cached, setCached] = useState<boolean>(false);
  const [ageSec, setAgeSec] = useState<number | null>(null);
  const [stats, setStats] = useState<{
    h1: { high: number; low: number; avg: number };
    h6: { high: number; low: number; avg: number };
    h24: { high: number; low: number; avg: number };
  }>({
    h1: { high: 0, low: 0, avg: 0 },
    h6: { high: 0, low: 0, avg: 0 },
    h24: { high: 0, low: 0, avg: 0 },
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadCache = () => {
    const cachedData = localStorage.getItem("history");
    if (cachedData) {
      try {
        const parsed: DataPoint[] = JSON.parse(cachedData);
        if (parsed.length > 0) {
          setHistory(parsed);
          const last = parsed[parsed.length - 1];
          setGasPrice(last.gas);
          setBlobFee(last.blob);
          setBlockNumber(last.block);
          setLastUpdated(last.timestamp);
          setCached(true);
        }
      } catch {}
    }
  };

  const saveCache = (data: DataPoint[]) => {
    localStorage.setItem("history", JSON.stringify(data));
  };

  const fetchData = useCallback(async () => {
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
      const baseFeePerGas = BigInt(blockData.result.baseFeePerGas);
      const blobBaseFee = Number(
        (excessBlobGas * baseFeePerGas) / BigInt(2) / BigInt(1e9)
      );

      const newPoint: DataPoint = {
        gas,
        blob: blobBaseFee,
        block,
        timestamp: Date.now(),
      };

      setGasPrice(gas);
      setBlobFee(blobBaseFee);
      setBlockNumber(block);
      setLastUpdated(newPoint.timestamp);
      setCached(false);

      setHistory((prev) => {
        const updated = [...prev, newPoint].slice(-200);
        saveCache(updated);
        return updated;
      });
    } catch {
      // keep cached values if fetch fails
    }
  };

  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  useEffect(() => {
    loadCache();
    fetchData();
    const fetchInterval = setInterval(fetchData, 12000);
    const ageInterval = setInterval(() => {
      if (lastUpdated) {
        setAgeSec(Math.floor((Date.now() - lastUpdated) / 1000));
      }
    }, 1000);
    return () => {
      clearInterval(fetchInterval);
      clearInterval(ageInterval);
    };
  }, []);

  useEffect(() => {
    if (!history.length) return;
    const now = Date.now();
    const periods = [
      { key: "h1", ms: 3600 * 1000 },
      { key: "h6", ms: 6 * 3600 * 1000 },
      { key: "h24", ms: 24 * 3600 * 1000 },
    ];
    const newStats: typeof stats = {
      h1: { high: 0, low: 0, avg: 0 },
      h6: { high: 0, low: 0, avg: 0 },
      h24: { high: 0, low: 0, avg: 0 },
    };
    periods.forEach(({ key, ms }) => {
      const slice = history.filter((p) => now - p.timestamp <= ms);
      if (slice.length) {
        const values = slice.map((p) => p.gas);
        const high = Math.max(...values);
        const low = Math.min(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        newStats[key as keyof typeof newStats] = { high, low, avg };
      }
    });
    setStats(newStats);
  }, [history]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      if (!history.length) return;
      const values = history.map((p) => p.gas);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;
      const step = width / (history.length - 1);
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 1;
      ctx.beginPath();
      history.forEach((p, i) => {
        const x = i * step;
        const y = height - ((p.gas - min) / range) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    draw();
    const interval = setInterval(draw, 1000);
    return () => clearInterval(interval);
  }, [history]);

  const gasColor =
    gasPrice !== null
      ? gasPrice < 0.05
        ? "text-green-400"
        : gasPrice < 0.2
        ? "text-yellow-400"
        : "text-red-400"
      : "";

  return (
    <div className="text-center w-full">
      <h1 className="text-4xl font-bold mb-4">Base Gas & Blob Fee Tracker</h1>
      <div className="space-y-2">
        <div>
          <span className="font-mono text-2xl mr-2">Legacy Gas Price:</span>
          <span className={gasColor}>
            {gasPrice !== null ? gasPrice.toFixed(8) : "—"} Gwei
          </span>
          {cached && <span className="ml-2 text-sm">(cached)</span>}
        </div>
        <div>
          <span className="font-mono text-2xl mr-2">Blob Base Fee:</span>
          <span>
            {blobFee !== null ? blobFee.toFixed(8) : "—"} Gwei
          </span>
          {cached && <span className="ml-2 text-sm">(cached)</span>}
        </div>
        <div>
          <span className="font-mono text-2xl mr-2">Block Number:</span>
          <span>{blockNumber !== null ? blockNumber : "—"}</span>
          {cached && <span className="ml-2 text-sm">(cached)</span>}
        </div>
        <div className="text-sm text-gray-400">
          {ageSec !== null && <span>Last updated {ageSec} seconds ago</span>}
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full h-48 mt-4" />
      <div className="text-sm text-gray-400 mt-2">
        <div>
          1h: high {stats.h1.high.toFixed(8)} / low {stats.h1.low.toFixed(8)} / avg{" "}
          {stats.h1.avg.toFixed(8)}
        </div>
        <div>
          6h: high {stats.h6.high.toFixed(8)} / low {stats.h6.low.toFixed(8)} / avg{" "}
          {stats.h6.avg.toFixed(8)}
        </div>
        <div>
          24h: high {stats.h24.high.toFixed(8)} / low {stats.h24.low.toFixed(8)} / avg{" "}
          {stats.h24.avg.toFixed(8)}
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
