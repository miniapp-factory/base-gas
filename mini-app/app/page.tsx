import { description, title } from "@/lib/metadata";
import { generateMetadata } from "@/lib/farcaster-embed";
import Dashboard from "@/components/dashboard";

export { generateMetadata };

export default function Home() {
  // NEVER write anything here, only use this page to import components
  return (
    <main className="flex flex-col gap-3 place-items-center place-content-center px-4 grow min-h-screen bg-black text-green-400 font-mono">
      <Dashboard />
    </main>
  );
}
