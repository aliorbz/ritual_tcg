"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { CONTRACTS, ROLE_COLORS } from "@/lib/config";
import { CardPreview } from "@/components/CardPreview";
import { PlusCircle, Loader2, Tag, X, AlertTriangle, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── List for Sale Modal ────────────────────────────────────────────
function ListModal({ tokenId, onClose, onSuccess }: { tokenId: bigint; onClose: () => void; onSuccess?: () => void }) {
  const [price, setPrice] = useState("");
  const [step, setStep] = useState<"approve" | "list">("approve");

  const { address } = useAccount();

  // Dynamically check if already approved
  const { data: isApproved } = useReadContract({
    address: CONTRACTS.NFT.address,
    abi: CONTRACTS.NFT.abi,
    functionName: "isApprovedForAll",
    args: address ? [address, CONTRACTS.MARKETPLACE.address] : undefined,
    query: { enabled: !!address },
  });

  const { data: approveHash, writeContract: approve, isPending: isApprovePending } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });

  const { data: listHash, writeContract: list, isPending: isListPending } = useWriteContract();
  const { isLoading: isListConfirming, isSuccess: isListConfirmed } = useWaitForTransactionReceipt({ hash: listHash });

  useEffect(() => {
    if (isApproved || isApproveConfirmed) {
      setStep("list");
    }
  }, [isApproved, isApproveConfirmed]);

  useEffect(() => {
    if (isListConfirmed && onSuccess) onSuccess();
  }, [isListConfirmed, onSuccess]);

  const handleApprove = () => {
    approve({
      address: CONTRACTS.NFT.address,
      abi: CONTRACTS.NFT.abi,
      functionName: "setApprovalForAll",
      args: [CONTRACTS.MARKETPLACE.address, true],
    });
  };

  const handleList = () => {
    if (!price || parseFloat(price) <= 0) return;
    list({
      address: CONTRACTS.MARKETPLACE.address,
      abi: CONTRACTS.MARKETPLACE.abi,
      functionName: "listItem",
      args: [CONTRACTS.NFT.address, tokenId, parseEther(price)],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#111] border border-white/10 rounded-[28px] p-8 max-w-sm w-full relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white"><X size={20} /></button>
        <Tag className="text-white/40 mb-4" size={32} />
        <h3 className="text-2xl font-black mb-1">List for Sale</h3>
        <p className="text-white/40 text-sm mb-6">Card <strong className="text-white">#{tokenId.toString()}</strong></p>

        {/* Step 1: Approve */}
        <div className={`rounded-2xl p-4 mb-3 border transition-all ${step === "approve" ? "border-white/20 bg-white/5" : "border-white/5 opacity-50"}`}>
          <div className="flex items-center gap-3">
            {isApproveConfirmed ? <CheckCircle size={18} className="text-green-400 flex-shrink-0" /> : <div className="w-5 h-5 rounded-full border-2 border-white/30 flex items-center justify-center text-xs font-black text-white/50">1</div>}
            <div>
              <p className="font-black text-sm">Approve Marketplace</p>
              <p className="text-white/30 text-xs">One-time: Allow the contract to transfer your card</p>
            </div>
          </div>
          {step === "approve" && !isApproveConfirmed && (
            <button
              onClick={handleApprove}
              disabled={isApprovePending || isApproveConfirming}
              className="mt-3 w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all font-black text-sm disabled:opacity-50"
            >
              {isApprovePending ? "Waiting..." : isApproveConfirming ? "Confirming..." : "Approve"}
            </button>
          )}
        </div>

        {/* Step 2: List */}
        <div className={`rounded-2xl p-4 mb-6 border transition-all ${step === "list" ? "border-white/20 bg-white/5" : "border-white/5 opacity-30"}`}>
          <div className="flex items-center gap-3 mb-3">
            {isListConfirmed ? <CheckCircle size={18} className="text-green-400 flex-shrink-0" /> : <div className="w-5 h-5 rounded-full border-2 border-white/30 flex items-center justify-center text-xs font-black text-white/50">2</div>}
            <div>
              <p className="font-black text-sm">Set Price & List</p>
              <p className="text-white/30 text-xs">Buyer pays this amount · you receive 95%</p>
            </div>
          </div>
          {step === "list" && !isListConfirmed && (
            <>
              <div className="relative mb-3">
                <input
                  type="number" min="0" step="0.001" placeholder="0.00"
                  value={price} onChange={e => setPrice(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-black focus:outline-none focus:border-white/30 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 font-bold text-xs">RITUAL</span>
              </div>
              <button
                onClick={handleList}
                disabled={isListPending || isListConfirming || !price}
                className="w-full py-3 rounded-xl bg-white text-black font-black text-sm hover:bg-white/90 transition-all disabled:opacity-50"
              >
                {isListPending ? "Waiting..." : isListConfirming ? "Listing..." : "List Card"}
              </button>
            </>
          )}
        </div>

        {isListConfirmed && (
          <div className="text-center">
            <p className="text-green-400 font-black text-lg">🎉 Card Listed!</p>
            <p className="text-white/40 text-xs mt-1">It's now visible on the Marketplace.</p>
            <button onClick={onClose} className="mt-4 text-white/50 text-sm hover:text-white">Close</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Accept Offer Modal ─────────────────────────────────────────────
function AcceptOfferModal({ tokenId, offerers, onClose, onSuccess }: { tokenId: bigint; offerers: string[]; onClose: () => void; onSuccess?: () => void }) {
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess && onSuccess) onSuccess();
  }, [isSuccess, onSuccess]);

  const handleAccept = (offerer: string) => {
    writeContract({
      address: CONTRACTS.MARKETPLACE.address,
      abi: CONTRACTS.MARKETPLACE.abi,
      functionName: "acceptOffer",
      args: [CONTRACTS.NFT.address, tokenId, offerer as `0x${string}`],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#111] border border-white/10 rounded-[28px] p-8 max-w-sm w-full relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white"><X size={20} /></button>
        <h3 className="text-2xl font-black mb-1">Active Offers</h3>
        <p className="text-white/40 text-sm mb-6">Card <strong className="text-white">#{tokenId.toString()}</strong></p>

        {isSuccess ? (
          <div className="text-center">
            <p className="text-green-400 font-black text-lg">✅ Offer Accepted!</p>
            <p className="text-white/40 text-xs mt-1">95% of the offer amount has been sent to your wallet.</p>
            <button onClick={onClose} className="mt-4 text-white/50 text-sm hover:text-white">Close</button>
          </div>
        ) : offerers.length === 0 ? (
          <p className="text-white/30 text-sm">No active offers on this card yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {offerers.map((offerer) => (
              <OfferRow key={offerer} offerer={offerer} tokenId={tokenId} onAccept={handleAccept} isPending={isPending || isConfirming} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function OfferRow({ offerer, tokenId, onAccept, isPending }: { offerer: string; tokenId: bigint; onAccept: (o: string) => void; isPending: boolean }) {
  const { data } = useReadContract({
    address: CONTRACTS.MARKETPLACE.address,
    abi: CONTRACTS.MARKETPLACE.abi,
    functionName: "offers",
    args: [CONTRACTS.NFT.address, tokenId, offerer as `0x${string}`],
  });
  const offer = data as { offerer: string; amount: bigint; active: boolean } | undefined;

  if (!offer || !offer.active) return null;

  return (
    <div className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-3">
      <div>
        <p className="font-mono text-xs text-white/50">{offerer.slice(0, 6)}...{offerer.slice(-4)}</p>
        <p className="font-black text-white">{formatEther(offer.amount)} RITUAL</p>
      </div>
      <button
        onClick={() => onAccept(offerer)}
        disabled={isPending}
        className="px-4 py-2 rounded-xl bg-green-500 text-black font-black text-xs hover:bg-green-400 transition-all disabled:opacity-50"
      >
        Accept
      </button>
    </div>
  );
}

// ─── Collected Card Item ───────────────────────────────────────────
function OwnedCardItem({ token, address, onRefresh }: { token: any; address: string; onRefresh: () => void }) {
  const [showListModal, setShowListModal] = useState(false);
  const [showOffersModal, setShowOffersModal] = useState(false);
  const tokenId = BigInt(token.tokenId);

  // Custom metadata from local file system API
  const [metadata, setMetadata] = useState<any>(null);

  useEffect(() => {
    async function fetchLocalMeta() {
      try {
        const res = await fetch(`/api/metadata/${token.tokenId}?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          setMetadata(data);
        }
      } catch (_) {
        // Fallback handled gracefully
      }
    }
    fetchLocalMeta();
  }, [token.tokenId]);

  // Check if currently listed
  const { data: listingIdData, refetch: refetchListingId } = useReadContract({
    address: CONTRACTS.MARKETPLACE.address,
    abi: CONTRACTS.MARKETPLACE.abi,
    functionName: "activeListings",
    args: [CONTRACTS.NFT.address, tokenId],
    query: { refetchInterval: 5000 },
  });
  const listingId = listingIdData as bigint | undefined;
  const isListed = listingId !== undefined && listingId > BigInt(0);

  // Get listing price if listed
  const { data: listingData, refetch: refetchListing } = useReadContract({
    address: CONTRACTS.MARKETPLACE.address,
    abi: CONTRACTS.MARKETPLACE.abi,
    functionName: "listings",
    args: isListed ? [listingId!] : [BigInt(0)],
    query: { enabled: isListed, refetchInterval: 5000 },
  });
  const listing = listingData as unknown as { listingId: bigint; nftAddress: string; tokenId: bigint; seller: string; price: bigint; active: boolean } | undefined;

  // Cancel listing
  const { data: cancelListHash, writeContract: cancelListing, isPending: isCancelPending } = useWriteContract();
  const { isLoading: isCancelConfirming, isSuccess: isCancelConfirmed } = useWaitForTransactionReceipt({ hash: cancelListHash });

  // Refetch after cancel
  useEffect(() => {
    if (isCancelConfirmed) {
      refetchListingId();
      refetchListing();
      onRefresh();
    }
  }, [isCancelConfirmed]);

  // Get all offerers
  const { data: offerersData, refetch: refetchOfferers } = useReadContract({
    address: CONTRACTS.MARKETPLACE.address,
    abi: CONTRACTS.MARKETPLACE.abi,
    functionName: "getOfferers",
    args: [CONTRACTS.NFT.address, tokenId],
    query: { refetchInterval: 10000 },
  });
  const offerers = (offerersData as string[] | undefined) || [];

  const roleType = (metadata?.discordRole || token.discordRole || "seeker").toLowerCase();
  const colors = (ROLE_COLORS as any)[roleType] || ROLE_COLORS.seeker;

  const handleCancelListing = () => {
    if (!listingId || listingId === BigInt(0)) return;
    cancelListing({
      address: CONTRACTS.MARKETPLACE.address,
      abi: CONTRACTS.MARKETPLACE.abi,
      functionName: "cancelListing",
      args: [listingId],
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center"
      >
        <div className="mb-4 w-full sm:w-auto flex justify-center">
          <Link href={`/card/${token.tokenId}`} className="block transition-transform duration-300 hover:scale-[1.02] w-full sm:w-auto">
            <CardPreview
              username={metadata?.name || token.discordUsername}
              avatar={metadata?.image || `https://cdn.discordapp.com/embed/avatars/${parseInt(token.discordId || "0") % 6}.png`}
              role={{ type: roleType, name: metadata?.discordRole || token.discordRole || "Seeker" }}
              walletAddress={address as `0x${string}`}
              tokenId={token.tokenId}
              stats={metadata?.traits || { messages: "0", level: "1", activity: "New" }}
            >
              <div className="space-y-1 sm:space-y-1.5 w-full">
                {/* Active price badge on card face */}
                {isListed && listing && listing.active && (
                  <div className="text-left pl-1 sm:pl-1.5 mb-0.5 sm:mb-1">
                    <span 
                      className="text-[14px] xs:text-base sm:text-3xl font-black uppercase tracking-tight text-white font-sans"
                      style={{ textShadow: "0 2px 4px rgba(0,0,0,1), 0 4px 12px rgba(0,0,0,1)" }}
                    >
                      {formatEther(listing.price)} RITUAL
                    </span>
                  </div>
                )}
                {/* Offers badge on card face */}
                {offerers.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowOffersModal(true);
                    }}
                    className="w-full text-[7px] xs:text-[9px] sm:text-[9px] font-black text-center py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-all uppercase tracking-wider"
                  >
                    📨 {offerers.length} Offer{offerers.length > 1 ? "s" : ""}
                  </button>
                )}
                {/* Actions inside card face */}
                {isListed ? (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCancelListing();
                    }}
                    disabled={isCancelPending || isCancelConfirming}
                    className="w-full py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-[8px] xs:text-[9px] sm:text-[10px] font-black uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-1 sm:gap-1.5"
                  >
                    {isCancelPending ? "Wait..." : isCancelConfirming ? "Remov..." : isCancelConfirmed ? "✅ Removed" : "Remove Listing"}
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowListModal(true);
                    }}
                    className="w-full py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl font-black text-[8px] xs:text-[10px] sm:text-xs text-black transition-all hover:brightness-110 flex items-center justify-center gap-1"
                    style={{ backgroundColor: colors.primary }}
                  >
                    List Card
                  </button>
                )}
              </div>
            </CardPreview>
          </Link>
        </div>
      </motion.div>

      <AnimatePresence>
        {showListModal && (
          <ListModal
            tokenId={tokenId}
            onClose={() => setShowListModal(false)}
            onSuccess={() => {
              refetchListingId();
              refetchListing();
              onRefresh();
            }}
          />
        )}
        {showOffersModal && (
          <AcceptOfferModal
            tokenId={tokenId}
            offerers={offerers}
            onClose={() => setShowOffersModal(false)}
            onSuccess={() => {
              refetchOfferers();
              onRefresh();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Main Export ───────────────────────────────────────────────────
export function CollectedCards() {
  const { address } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey(k => k + 1);

  // 1. Get NFT balance
  const { data: balanceData, isLoading: isBalanceLoading, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.NFT.address,
    abi: CONTRACTS.NFT.abi,
    functionName: "balanceOf",
    args: [address ?? ("0x0000000000000000000000000000000000000000" as `0x${string}`)],
    query: { enabled: !!address, refetchOnMount: true },
  });

  const balance = balanceData ? Number(balanceData) : 0;

  // Refetch on refresh
  useEffect(() => {
    if (refreshKey > 0) refetchBalance();
  }, [refreshKey]);

  // 2. Get token IDs via tokenOfOwnerByIndex
  const tokenIndexCalls = Array.from({ length: balance }, (_, i) => ({
    address: CONTRACTS.NFT.address,
    abi: CONTRACTS.NFT.abi,
    functionName: "tokenOfOwnerByIndex" as const,
    args: [address!, BigInt(i)] as [`0x${string}`, bigint],
  }));

  const { data: tokenIdsData, isLoading: isTokenIdsLoading } = useReadContracts({
    contracts: tokenIndexCalls as any,
    query: { enabled: balance > 0 && !!address },
  });

  // 3. Get card metadata
  const cardDataCalls = (tokenIdsData || []).map((r: any) => ({
    address: CONTRACTS.NFT.address,
    abi: CONTRACTS.NFT.abi,
    functionName: "cardData" as const,
    args: r.result !== undefined ? [r.result] : [BigInt(0)],
  }));

  const { data: metadataResults, isLoading: isMetadataLoading } = useReadContracts({
    contracts: cardDataCalls as any,
    query: { enabled: cardDataCalls.length > 0 },
  });

  const isLoading = isBalanceLoading || isTokenIdsLoading || isMetadataLoading;

  const tokens = React.useMemo(() => {
    if (!tokenIdsData || !metadataResults) return [];
    return tokenIdsData.map((idResult: any, i) => {
      const tokenId = idResult.result;
      const meta = metadataResults[i]?.result as { discordId: string; discordRole: string; discordUsername: string } | [string, string, string] | undefined;
      if (tokenId === undefined || !meta) return null;
      // Handle both tuple and named return formats
      const discordId = Array.isArray(meta) ? meta[0] : meta.discordId;
      const discordRole = Array.isArray(meta) ? meta[1] : meta.discordRole;
      const discordUsername = Array.isArray(meta) ? meta[2] : meta.discordUsername;
      return {
        tokenId: tokenId.toString(),
        discordId,
        discordRole,
        discordUsername,
      };
    }).filter(Boolean);
  }, [tokenIdsData, metadataResults]);

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white/5 border border-white/10 rounded-3xl w-full">
        <p className="text-white/40">Connect your wallet to see your collected cards.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 w-full">
        <Loader2 className="animate-spin text-white/30 mb-4" size={32} />
        <p className="text-white/40 font-bold uppercase tracking-widest text-sm">Loading Collection...</p>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        <div className="aspect-[3/4] rounded-[32px] border-2 border-dashed border-white/5 bg-white/[0.02] flex flex-col items-center justify-center p-8 text-center group hover:border-white/20 transition-all cursor-pointer">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <PlusCircle className="text-white/20" size={32} />
          </div>
          <h4 className="font-bold mb-2">No Cards Yet</h4>
          <p className="text-xs text-white/30">Head to the Create tab to mint your first Ritual TCG card.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-8 justify-items-start w-full">
      {tokens.map((token: any) => (
        <div key={token.tokenId} className="w-full flex justify-start sm:justify-center">
          <OwnedCardItem token={token} address={address} onRefresh={triggerRefresh} />
        </div>
      ))}
    </div>
  );
}
