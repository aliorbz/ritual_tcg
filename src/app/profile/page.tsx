"use client";

import React from "react";
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { formatEther, parseEther, createPublicClient, http } from "viem";
import { useSession, signIn, signOut } from "next-auth/react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { 
  User, 
  Wallet, 
  Grid, 
  PlusCircle, 
  Settings, 
  ExternalLink, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles, 
  RefreshCw, 
  LogOut,
  Upload
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RITUAL_NETWORK, ROLE_COLORS, CONTRACTS } from "@/lib/config";
import { Navbar } from "@/components/Navbar";
import { CardPreview } from "@/components/CardPreview";
import { getDiscordUserRoles } from "@/lib/actions";
import { CollectedCards } from "@/components/CollectedCards";
import { getHighResDiscordUrl } from "@/lib/utils";

const VerifiedRosette = ({ size = 28, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path 
      d="M12 2L14.4 4.5L17.8 4L18.3 7.4L21.5 8.9L20.2 12.1L22.2 15L19.4 17L18.7 20.3L15.3 19.9L13 22.4L10 20.7L6.7 21.1L6 17.8L3 16.3L4.3 13L2.3 10L5.1 8L5.8 4.7L9.2 5.1L11.5 2.6L12 2Z" 
      fill={`${color}15`}
    />
    <path d="M9 12L11 14L15 9" strokeWidth="3" />
  </svg>
);

const DiscordPermissionPreview = () => (
  <div className="w-full space-y-3 mb-8 text-left">
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <CheckCircle2 className="mt-0.5 text-emerald-400 shrink-0" size={18} />
      <div>
        <p className="text-sm font-black text-white">Retrieve profile details for card generation</p>
        <p className="text-xs text-white/45 font-sans mt-1">
          Used to access your Discord username and avatar for TCG generation
        </p>
      </div>
    </div>
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <ShieldCheck className="mt-0.5 text-[#5865F2] shrink-0" size={18} />
      <div>
        <p className="text-sm font-black text-white">Verify your Ritual community role</p>
        <p className="text-xs text-white/45 font-sans mt-1">
          Used to verify your Ritual server membership and role
        </p>
      </div>
    </div>
  </div>
);

const DiscordTrustNote = () => (
  <p className="text-xs text-white/40 leading-relaxed font-sans mt-4 max-w-md">
    We only use your Discord profile and Ritual role to generate your Ritual TCG card. We do not access messages, passwords, or send actions on your behalf.
  </p>
);

// Setup dynamic client for metadata setup
const RITUAL_CHAIN = {
  id: RITUAL_NETWORK.id,
  name: RITUAL_NETWORK.name,
  nativeCurrency: RITUAL_NETWORK.nativeCurrency,
  rpcUrls: { 
    default: { 
      http: [process.env.NODE_ENV === "development" ? "http://127.0.0.1:8545" : "https://rpc.ritualfoundation.org"] 
    } 
  },
} as const;

function getClient() {
  return createPublicClient({ chain: RITUAL_CHAIN as any, transport: http() });
}

export default function ProfilePage() {
  const { isConnected, address } = useAccount();
  const { data: session } = useSession();
  
  const activeSession = session as any;

  const [activeTab, setActiveTab] = React.useState("cards");
  const [userData, setUserData] = React.useState<any>(null);

  // Get active tab from URL query params
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "create" || tab === "cards") {
        setActiveTab(tab);
      }
    }
  }, []);

  const roleType = userData?.role?.type || "ritualist";
  const colors = (ROLE_COLORS as any)[roleType] || ROLE_COLORS.ritualist;
  const [isRoleLoading, setIsRoleLoading] = React.useState(false);
  const [customImage, setCustomImage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [mintError, setMintError] = React.useState<string | null>(null);

  // Wagmi Write Contract Hook
  const { data: hash, writeContract, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // ─── Track global user mint limit (exactly 1 card per Discord account) ───
  const discordId = activeSession?.user?.id || (activeSession ? "mock-discord-id-123" : "");
  const currentRoleName = userData?.role?.name || "Ritualist";
  
  const { data: hasMintedData, refetch: refetchHasMinted } = useReadContract({
    address: CONTRACTS.NFT.address,
    abi: CONTRACTS.NFT.abi,
    functionName: "checkHasMinted",
    args: [discordId],
    query: { enabled: !!discordId && !!userData },
  });
  const hasMinted = Boolean(hasMintedData);

  // Show write errors
  React.useEffect(() => {
    if (writeError) {
      const msg = (writeError as any)?.shortMessage || writeError?.message || "Transaction failed";
      setMintError(msg);
    }
  }, [writeError]);

  // Intercept successful mint to write metadata JSON
  React.useEffect(() => {
    async function initializeMetadata() {
      if (isConfirmed && userData && activeSession && address) {
        refetchHasMinted();
        const client = getClient();
        try {
          const balance = await client.readContract({
            address: CONTRACTS.NFT.address,
            abi: CONTRACTS.NFT.abi,
            functionName: "balanceOf",
            args: [address],
          }) as bigint;
          
          if (balance > BigInt(0)) {
            const tokenId = await client.readContract({
              address: CONTRACTS.NFT.address,
              abi: CONTRACTS.NFT.abi,
              functionName: "tokenOfOwnerByIndex",
              args: [address, balance - BigInt(1)],
            }) as bigint;
            
            const defaultMeta = {
              tokenId: tokenId.toString(),
              name: activeSession.user?.name || "Ritualist",
              description: `A unique collectible card from the Ritual TCG ecosystem. This card represents your verified role (${userData.role.name}) and contribution to the network.`,
              image: customImage || getHighResDiscordUrl(activeSession.user?.image) || `https://cdn.discordapp.com/embed/avatars/${parseInt(discordId || "0") % 6}.png`,
              discordId,
              discordRole: userData.role.name,
              discordUsername: activeSession.user?.name || "user",
              traits: {
                messageCount: userData.stats?.messages || "0",
                level: userData.stats?.level || "1",
                topRole: userData.role.name,
                daysInServer: "120",
                activity: userData.stats?.activity || "Medium"
              },
              customImage: customImage || null
            };
            
            await fetch(`/api/metadata/${tokenId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(defaultMeta)
            });
            
            setCustomImage(null); 
            setActiveTab("cards"); 
          }
        } catch (err) {
          console.error("Failed to dynamically configure local metadata", err);
        }
      }
    }
    initializeMetadata();
  }, [isConfirmed, userData, activeSession, address, discordId, customImage, refetchHasMinted]);

  const handleMint = async () => {
    if (!address || !userData || !activeSession) return;
    setMintError(null);
    try {
      writeContract({
        address: CONTRACTS.NFT.address,
        abi: CONTRACTS.NFT.abi,
        functionName: "mintCard",
        args: [
          address,
          discordId,
          userData.role.name,
          activeSession.user?.name || "user",
        ],
        value: parseEther("0.01"),
      });
    } catch (e: any) {
      console.error("Minting failed", e);
      setMintError(e?.shortMessage || e?.message || "Mint failed");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Safety guard to avoid Vercel Serverless Function 4.5MB payload limit
    if (file.size > 4.5 * 1024 * 1024) {
      alert("File is too large. Please select an image under 4.5MB to keep it high quality.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCustomImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Sync / Fetch roles for session
  const loadRoles = React.useCallback(async () => {
    if (activeSession) {
      setIsRoleLoading(true);
      // Real Discord Syncing
      const data = await getDiscordUserRoles();
      if (data && !data.error) {
        setUserData(data);
      } else {
        setUserData({
          ineligible: true,
          error: data?.error || "We could not verify your guild membership status. Please log in again."
        });
      }
      setIsRoleLoading(false);
    }
  }, [activeSession]);

  React.useEffect(() => {
    loadRoles();
  }, [loadRoles]);


  const { data: balanceData, isLoading: isBalanceLoading } = useBalance({
    address: address,
    chainId: RITUAL_NETWORK.id,
  });

  const readableBalance = balanceData
    ? parseFloat(formatEther(balanceData.value)).toFixed(4)
    : "0.0000";

  const getMintLabel = () => {
    if (isRoleLoading) return "Syncing...";
    if (isPending) return "Waiting in Wallet...";
    if (isConfirming) return "Minting on Chain...";
    if (isConfirmed) return "✅ Successfully Minted!";
    if (hasMinted) return "Role Already Minted";
    return "Mint TCG";
  };

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-[#050505] text-white">
        <Navbar />
        <div className="container mx-auto px-6 py-40 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-8 border border-white/10">
            <Wallet className="text-white/20" size={32} />
          </div>
          <h1 className="text-4xl font-black mb-4">Connect Wallet</h1>
          <p className="text-white/40 max-w-sm mb-10 font-sans">Connect your wallet to view your Ritual TCG profile and manage your cards.</p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white pb-20 font-['Outfit',sans-serif]">
      <style>{`
        @keyframes badge-glow {
          0%, 100% {
            filter: drop-shadow(0 0 3px var(--glow-color)) drop-shadow(0 0 8px var(--glow-color));
            opacity: 0.85;
          }
          50% {
            filter: drop-shadow(0 0 10px var(--glow-color)) drop-shadow(0 0 20px var(--glow-color));
            opacity: 1;
          }
        }
        .animate-badge-glow {
          animation: badge-glow 2.5s infinite ease-in-out;
        }
      `}</style>
      <Navbar />

      {/* Cover Area */}
      <div className="h-64 w-full relative border-b border-white/5 overflow-hidden z-0 bg-[#050505]">
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-35 filter blur-[3px]"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/media/ritualvid.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/45 to-[#050505]" />
      </div>

      <div className="container mx-auto px-6">
        <div className="relative -mt-20 flex flex-col md:flex-row md:items-end justify-between gap-8 pb-12 border-b border-white/5">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
            {/* Profile Picture */}
            <div className="w-40 h-40 rounded-[40px] bg-[#0a0a0a] border-4 border-[#050505] shadow-2xl overflow-hidden relative">
              {activeSession?.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeSession.user.image} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/10">
                  <User size={64} className="text-white/10" />
                </div>
              )}
            </div>

            <div className="text-center md:text-left mb-2">
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-3">
                <h1 className="text-4xl font-black tracking-tight uppercase">
                  {activeSession?.user?.name || "Ritual Explorer"}
                </h1>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-mono text-white/60 tracking-wider">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Role Badge */}
              <div className="flex items-center justify-center md:justify-start gap-2">
                <div
                  className="px-3 py-1 rounded-lg border transition-all"
                  style={{
                    backgroundColor: isRoleLoading ? "rgba(255,255,255,0.05)" : (ROLE_COLORS as any)[userData?.role?.type || "ritualist"]?.bg,
                    borderColor: isRoleLoading ? "rgba(255,255,255,0.1)" : (ROLE_COLORS as any)[userData?.role?.type || "ritualist"]?.border
                  }}
                >
                  <span
                    className={`text-[10px] font-black uppercase tracking-[0.2em] ${(ROLE_COLORS as any)[userData?.role?.type || "ritualist"]?.text || "text-white"}`}
                  >
                    {isRoleLoading ? "Syncing..." : (userData?.role?.name || "Ritualist")}
                  </span>
                </div>
                {activeSession && !isRoleLoading && <ShieldCheck className="text-blue-500" size={18} />}
              </div>
            </div>
          </div>

          {/* Connect / Disconnect Buttons */}
          <div className="flex items-center gap-3">
            {!activeSession ? (
              <div className="flex flex-col items-end">
                <button
                  onClick={() => signIn("discord")}
                  className="px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl font-black transition-all text-sm flex items-center gap-2 shadow-lg shadow-blue-500/10"
                >
                  Connect Discord
                </button>
                <p className="hidden md:block text-[11px] text-white/35 mt-2 max-w-xs text-right font-sans">
                  Uses only your Discord profile and Ritual role for card generation.
                </p>
              </div>
            ) : (
              <button
                onClick={() => signOut()}
                className="px-5 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl font-bold transition-all text-xs flex items-center gap-2"
              >
                <LogOut size={14} /> Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex w-full py-8 border-b border-white/5 mb-12 font-sans">
          {[
            { id: "cards", label: "Collected", icon: <Grid size={18} /> },
            { id: "create", label: "Create / Mint", icon: <PlusCircle size={18} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-1/2 flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest transition-all relative pb-8 -mb-[33px] ${
                activeTab === tab.id ? "text-white" : "text-white/30 hover:text-white"
              }`}
            >
              {tab.icon} {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="tabLine" className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="min-h-[400px]">
          {activeTab === "cards" && (
            <CollectedCards />
          )}

          {activeTab === "create" && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-10"
            >
              <div className="text-center mb-16 max-w-xl">
                <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter">Mint TCG Card</h2>
                <p className="text-white/40 leading-relaxed font-medium font-sans text-sm">Verify your Ritual community role and mint your custom card. Once minted, you can customize your layout from the details page.</p>
              </div>

              {!activeSession ? (
                <div className="p-12 rounded-[40px] bg-white/5 border border-white/10 text-center relative overflow-hidden group w-full max-w-lg">
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 bg-[#5865F2]/20 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-500">
                      <User className="text-[#5865F2]" size={36} />
                    </div>
                    <h2 className="text-2xl font-black mb-4">Connect Discord</h2>
                    <p className="text-white/40 mb-8 leading-relaxed font-sans text-sm">Please link your Discord account to generate your card from your profile and Ritual role.</p>
                    <DiscordPermissionPreview />
                    
                    <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                      <button
                        onClick={() => signIn("discord")}
                        className="px-8 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-2xl font-black transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3"
                      >
                        Connect Discord
                      </button>
                    </div>
                    <DiscordTrustNote />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-16 items-center lg:items-start w-full max-w-5xl mt-10">
                  {/* Left: Card Preview */}
                  <div className="flex-1 flex justify-center lg:justify-end">
                    <CardPreview
                      username={activeSession.user?.name || "Ritualist"}
                      avatar={customImage || activeSession.user?.image || ""}
                      role={userData?.role || { type: "ritualist", name: "Ritualist" }}
                      walletAddress={address}
                      stats={userData?.stats || { messages: "---", joins: "---", activity: "---" }}
                      insideCardPage={true}
                    />
                  </div>

                  {/* Right: Typography & Mint Actions */}
                  <div className="flex-1 flex flex-col justify-center items-center lg:items-start text-center lg:text-left pt-4">
                    {/* Top Verified Tag */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <ShieldCheck size={14} className={(ROLE_COLORS as any)[userData?.role?.type || "ritualist"]?.text || "text-blue-500"} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${(ROLE_COLORS as any)[userData?.role?.type || "ritualist"]?.text || "text-blue-500"} font-sans`}>
                        Ritual Verified
                      </span>
                    </div>

                    {/* Name & Badge */}
                    <div className="flex items-center gap-4 mb-4">
                      <h1 className="text-6xl font-black uppercase tracking-tighter text-white truncate max-w-sm">
                        {activeSession.user?.name}
                      </h1>
                      
                      {/* Verified Badge */}
                      <div className="relative group/tooltip">
                        <div 
                          className="w-10 h-10 flex items-center justify-center cursor-pointer transition-all duration-300 animate-badge-glow"
                          style={{
                            '--glow-color': colors.isGradient ? "#bae6fd" : colors.primary
                          } as any}
                        >
                          <VerifiedRosette size={38} color={colors.isGradient ? "#bae6fd" : colors.primary} />
                        </div>
                        
                        {/* Tooltip Content */}
                        <div className="absolute bottom-full mb-3 right-1/2 translate-x-1/2 pointer-events-none opacity-0 group-hover/tooltip:opacity-100 transition-all duration-300 transform translate-y-1 group-hover/tooltip:translate-y-0 z-50">
                          <div className="bg-[#181818] border border-white/10 text-white text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-xl shadow-2xl whitespace-nowrap">
                            {userData?.role?.name || "Ritualist"}
                          </div>
                          <div className="w-2.5 h-2.5 bg-[#181818] border-r border-b border-white/10 rotate-45 mx-auto -mt-1.5" />
                        </div>
                      </div>
                    </div>

                    {/* Sub-info */}
                    <div className="flex items-center gap-4 text-sm font-bold mb-10 font-sans">
                      <span className="text-white/40">Discord: <span className={(ROLE_COLORS as any)[userData?.role?.type || "ritualist"]?.text || "text-blue-500"}>@{userData?.trueUsername || (activeSession.user?.name || "user").toLowerCase().replace(/\s+/g, '')}</span></span>
                      <span className="text-white/40">Address: <span className={(ROLE_COLORS as any)[userData?.role?.type || "ritualist"]?.text || "text-blue-500"}>{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "0x..."}</span></span>
                    </div>

                    {/* Already minted banner */}
                    {hasMinted && (
                      <div className="w-full max-w-sm mb-4 px-5 py-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3 font-sans">
                        <CheckCircle2 size={18} className="text-yellow-400 flex-shrink-0" />
                        <div className="text-left">
                          <p className="text-sm font-black text-yellow-400">Card Already Minted</p>
                          <p className="text-xs text-white/40">Your Discord account has already minted a card. If you recently got a role upgrade, you can directly sync it by clicking the Sync button inside your Collected Card details!</p>
                        </div>
                      </div>
                    )}

                    {/* Mint Button */}
                    <button
                      disabled={isRoleLoading || isPending || isConfirming || hasMinted}
                      onClick={handleMint}
                      className="w-full max-w-sm py-5 rounded-[20px] font-black text-2xl uppercase tracking-tighter transition-all active:scale-95 flex items-center justify-center gap-3 text-black hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: (ROLE_COLORS as any)[userData?.role?.type || "ritualist"]?.primary || "#3b82f6",
                        boxShadow: `0 10px 30px -10px ${(ROLE_COLORS as any)[userData?.role?.type || "ritualist"]?.primary || "#3b82f6"}`
                      }}
                    >
                      {getMintLabel()}
                    </button>

                    {/* Error */}
                    {mintError && (
                      <div className="mt-3 w-full max-w-sm px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 font-sans">
                        <p className="text-xs font-bold text-red-400">{mintError}</p>
                      </div>
                    )}

                    {/* Mint Info */}
                    <div className="flex items-center gap-6 mt-6 lg:ml-2 text-[10px] font-bold text-white/30 uppercase tracking-widest font-sans">
                      <div>Fee: <span className="text-white/70">0.01 RITUAL</span></div>
                      <div>Contract: <span className="text-white/70">{CONTRACTS.NFT.address.slice(0,6)}...{CONTRACTS.NFT.address.slice(-4)}</span></div>
                    </div>

                    {/* Manual Upload */}
                    <div className="mt-8 flex flex-col lg:items-start items-center font-sans">
                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <div className="flex flex-col items-center lg:items-start gap-3">
                        <p className="text-base font-black text-white/80 uppercase tracking-wide">
                          Low image resolution?
                        </p>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-6 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all font-black text-sm uppercase tracking-wider flex items-center gap-2 shadow-lg"
                        >
                          <Upload size={14} style={{ color: colors.primary }} />
                          Upload Manually
                        </button>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">
                          (PFP can be changed anytime in TCG profile details)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </main>
  );
}
