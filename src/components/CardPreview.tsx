"use client";

import React, { useRef } from "react";
import { motion } from "framer-motion";
import { ROLE_COLORS } from "@/lib/config";
import { getHighResDiscordUrl } from "@/lib/utils";

interface CardPreviewProps {
  role: { type: string, name: string };
  username: string;
  avatar: string;
  stats?: { messages: string, level?: string, joins?: string, activity: string };
  walletAddress?: string;
  tokenId?: string;
  children?: React.ReactNode;
  insideCardPage?: boolean;
  isCompact?: boolean;
}

export function CardPreview({ role, username, avatar, stats, walletAddress, tokenId, children, insideCardPage = false, isCompact = false }: CardPreviewProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const roleType = (role?.type || "seeker").toLowerCase();
  const colors = (ROLE_COLORS as any)[roleType] || ROLE_COLORS.seeker;
  const isRadiant = roleType === "raiden" || roleType === "radiant";

  // Normalize stats to handle both Discord API and DB keys
  const messages = stats?.messages || (stats as any)?.messageCount || "0";
  const level = stats?.level || "1";
  const activity = stats?.activity || (stats as any)?.activity || "New";

  const highResAvatar = getHighResDiscordUrl(avatar);

  return (
    <div className={`relative group select-none w-full flex justify-center ${isCompact ? "" : "sm:w-auto"}`}>
      {/* Dynamic Glow Aura */}
      <div 
        className="absolute -inset-1 blur-[35px] rounded-[36px] opacity-20 group-hover:opacity-75 transition-all duration-700 pointer-events-none" 
        style={{ 
          background: colors.isGradient 
            ? colors.gradient 
            : `linear-gradient(to bottom, ${colors.primary}, ${colors.secondary || colors.primary})`
        }}
      />
      
      <div 
        ref={cardRef}
        id="card-capture-area"
        className={`relative rounded-2xl overflow-hidden bg-[#050505] border-2 shadow-2xl flex flex-col justify-between p-2.5 transition-transform duration-500 hover:scale-[1.02] border-white/10 ${
          insideCardPage 
            ? "w-[310px] h-[430px] xs:w-[340px] xs:h-[472px] sm:w-[280px] sm:h-[390px] sm:rounded-[32px] sm:p-4" 
            : (isCompact 
                ? "w-full aspect-[1/1.39] sm:w-[185px] sm:h-[258px] sm:rounded-2xl" 
                : "w-full aspect-[1/1.39] sm:w-[280px] sm:h-[390px] sm:rounded-[32px] sm:p-4 sm:aspect-auto")
        }`}
        style={{ 
          boxShadow: `0 20px 40px -15px ${colors.glow}`,
          background: isRadiant 
            ? undefined 
            : (colors.isGradient 
                ? `linear-gradient(#050505, #050505) padding-box, ${colors.gradient} border-box` 
                : undefined),
          borderColor: isRadiant 
            ? "#FFD700" 
            : (colors.isGradient ? "transparent" : colors.primary)
        }}
      >
        {/* Background Card Art (PFP) */}
        <div className="absolute inset-0 z-0 bg-[#0a0a0a]">
          {highResAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={highResAvatar} 
              alt="Avatar"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center">
              <span className="text-white/20 text-xs font-mono">No Image</span>
            </div>
          )}
          {/* Subtle dark shading at the bottom of the card face to ensure buttons are extremely legible */}
          {!insideCardPage && (
            <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />
          )}
        </div>

        {/* Dynamic Card Shimmer effect */}
        <div className="absolute inset-0 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-[linear-gradient(105deg,transparent_30%,rgba(255,255,255,0.08)_40%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.08)_60%,transparent_70%)] bg-[length:200%_100%] animate-[shimmer_2.5s_infinite_linear]" />

        {/* Big Bold ID badge for insideCardPage in top right */}
        {insideCardPage && (
          <div 
            className="absolute top-5 right-5 z-20 text-3xl sm:text-4xl font-mono font-black select-none text-white/95"
            style={{ textShadow: "0 4px 10px rgba(0,0,0,0.95), 0 0 15px rgba(0,0,0,0.8)" }}
          >
            #{tokenId ? tokenId : "0"}
          </div>
        )}

        {/* ── CARD HEADER (Name and NFT ID Badge on face) ── */}
        {!insideCardPage && (
          <div className={`relative z-20 w-full flex items-center justify-between gap-1 bg-black/60 backdrop-blur-md py-1.5 px-2 rounded-xl border border-white/10 shadow-lg ${
            isCompact 
              ? "" 
              : "sm:gap-2 sm:py-2.5 sm:px-3.5 sm:rounded-2xl"
          }`}>
            <div className="text-left min-w-0 flex-1">
              {colors.isGradient ? (
                <h3 
                  className={`font-black font-outfit uppercase tracking-wider truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] bg-clip-text text-transparent bg-gradient-to-r text-[10px] xs:text-xs ${
                    isCompact ? "" : "sm:text-sm"
                  }`}
                  style={{ backgroundImage: colors.gradient }}
                >
                  {username || "Ritual Explorer"}
                </h3>
              ) : (
                <h3 
                  className={`font-black font-outfit uppercase tracking-wider truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] text-[10px] xs:text-xs ${
                    isCompact ? "" : "sm:text-sm"
                  }`}
                  style={{ color: colors.primary }}
                >
                  {username || "Ritual Explorer"}
                </h3>
              )}
            </div>

            <div 
              className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-black flex-shrink-0 flex items-center justify-center bg-black/80 text-white/95 ${
                isCompact ? "" : "sm:rounded-lg sm:text-xs"
              }`}
              style={{ 
                borderColor: colors.isGradient ? "transparent" : colors.primary,
                background: colors.isGradient 
                  ? `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.8)) padding-box, ${colors.gradient} border-box` 
                  : undefined,
                border: colors.isGradient ? "1px transparent solid" : undefined,
                boxShadow: `0 0 10px ${colors.glow}60` 
              }}
            >
              #{tokenId ? tokenId : "0"}
            </div>
          </div>
        )}

        {/* ── CARD FOOTER (Action Buttons Only) ── */}
        <div className="relative z-20 w-full">
          {children && (
            <div className="relative z-30 w-full">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
