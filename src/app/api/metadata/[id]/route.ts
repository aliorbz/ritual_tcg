export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createPublicClient, http } from "viem";
import { RITUAL_NETWORK, CONTRACTS } from "@/lib/config";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getHighResDiscordUrl } from "@/lib/utils";

// Setup filesystem directory
const METADATA_DIR = path.join(process.cwd(), "src", "data", "metadata");

// Setup zero-config cloud KV database for secondary persistence fallback
const BUCKET_ID = "ritual_tcg_metadata_bucket_v1";
const KV_URL = `https://kvdb.io/${BUCKET_ID}/`;

// Setup viem public client for dynamic on-chain fallback
const RITUAL_CHAIN = {
  id: RITUAL_NETWORK.id,
  name: RITUAL_NETWORK.name,
  nativeCurrency: RITUAL_NETWORK.nativeCurrency,
  rpcUrls: {
    default: { http: [process.env.NODE_ENV === "development" ? "http://127.0.0.1:8545" : "https://rpc.ritualfoundation.org"] }
  }
} as const;

function getViemClient() {
  return createPublicClient({
    chain: RITUAL_CHAIN as any,
    transport: http()
  });
}

type StoredMetadata = {
  name?: string;
  discordId?: string;
  discordRole?: string;
  discordUsername?: string;
  traits?: {
    messageCount?: string;
    level?: string;
    topRole?: string;
    activity?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type ChainCardMetadata = {
  discordId: string;
  discordRole: string;
  discordUsername: string;
};

const roleStats: Record<string, { messages: string; level: string; activity: string; joins: string }> = {
  mod: { messages: "5.4k", level: "50", activity: "Master", joins: "Jan 2024" },
  raiden: { messages: "1.2k", level: "25", activity: "Legendary", joins: "Feb 2024" },
  ritualist: { messages: "450", level: "10", activity: "High", joins: "May 2024" },
  ritty: { messages: "120", level: "3", activity: "Medium", joins: "Aug 2024" },
  bitty: { messages: "45", level: "1", activity: "Low", joins: "Oct 2024" },
  seeker: { messages: "0", level: "1", activity: "None", joins: "New" },
};

async function readChainCardMetadata(id: string): Promise<ChainCardMetadata | null> {
  const client = getViemClient();
  const rawMeta = await client.readContract({
    address: CONTRACTS.NFT.address,
    abi: CONTRACTS.NFT.abi,
    functionName: "cardData",
    args: [BigInt(id)],
  }) as unknown;

  if (!rawMeta) return null;

  let discordId: string;
  let discordRole: string;
  let discordUsername: string;

  if (Array.isArray(rawMeta)) {
    [discordId, discordRole, discordUsername] = rawMeta as [string, string, string];
  } else {
    const meta = rawMeta as ChainCardMetadata;
    discordId = meta.discordId;
    discordRole = meta.discordRole;
    discordUsername = meta.discordUsername;
  }

  if (!discordId) return null;

  return { discordId, discordRole, discordUsername };
}

async function withLatestChainRole(id: string, metadata: StoredMetadata) {
  try {
    const chainMeta = await readChainCardMetadata(id);
    if (!chainMeta) return metadata;

    const roleType = (chainMeta.discordRole || "seeker").toLowerCase();
    const stats = roleStats[roleType] || roleStats.seeker;
    const oldUsername = metadata.discordUsername;

    return {
      ...metadata,
      discordId: chainMeta.discordId,
      discordRole: chainMeta.discordRole,
      discordUsername: chainMeta.discordUsername,
      name: !metadata.name || metadata.name === oldUsername ? chainMeta.discordUsername : metadata.name,
      traits: {
        ...metadata.traits,
        messageCount: metadata.traits?.messageCount || stats.messages,
        level: metadata.traits?.level || stats.level,
        topRole: chainMeta.discordRole,
        activity: metadata.traits?.activity || stats.activity,
      },
    };
  } catch (err) {
    console.error("On-chain metadata reconciliation failed:", err);
    return metadata;
  }
}

async function ensureDirectoryExists() {
  try {
    await fs.mkdir(METADATA_DIR, { recursive: true });
  } catch (err) {
    // Ignore if directory exists
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filePath = path.join(METADATA_DIR, `${id}.json`);

  // 1. Try to read from Supabase Database (if configured)
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from("tcg_metadata")
        .select("metadata")
        .eq("token_id", id)
        .single();
        
      if (!error && data && data.metadata) {
        return NextResponse.json(await withLatestChainRole(id, data.metadata));
      }
    } catch (sbErr) {
      console.error("Supabase read failed:", sbErr);
    }
  }

  // 2. Try to read from cloud KV (secondary persistent fallback)
  try {
    const res = await fetch(`${KV_URL}${id}`, { cache: "no-store" });
    if (res.ok) {
      const val = await res.json();
      if (val && typeof val === "object" && val.name) {
        return NextResponse.json(await withLatestChainRole(id, val));
      }
    }
  } catch (kvErr) {
    console.error("Cloud KV read failed:", kvErr);
  }

  try {
    await ensureDirectoryExists();
    // 3. Try to read from local JSON database (development mode backup)
    const fileContent = await fs.readFile(filePath, "utf-8");
    return NextResponse.json(await withLatestChainRole(id, JSON.parse(fileContent)));
  } catch (err) {
    // 4. Fallback: Query the blockchain
    try {
      const chainMeta = await readChainCardMetadata(id);

      if (!chainMeta) {
        return NextResponse.json({ error: "Token not found" }, { status: 404 });
      }

      const { discordId, discordRole, discordUsername } = chainMeta;

      if (!discordId) {
        return NextResponse.json({ error: "Token has no metadata" }, { status: 404 });
      }

      const roleType = (discordRole || "ritualist").toLowerCase();
      const stats = roleStats[roleType] || roleStats.ritualist;

      // Construct a default metadata structure mirroring Discord identity
      const defaultMeta = {
        tokenId: id,
        name: discordUsername || `Ritualist #${id}`,
        description: `A unique collectible card from the Ritual TCG ecosystem. This card represents your verified role (${discordRole}) and contribution to the network.`,
        image: `https://cdn.discordapp.com/embed/avatars/${parseInt(discordId || "0") % 6}.png`,
        discordId,
        discordRole,
        discordUsername,
        traits: {
          messageCount: stats.messages,
          level: stats.level,
          topRole: discordRole,
          daysInServer: "120",
          activity: stats.activity
        },
        customImage: null
      };

      return NextResponse.json(defaultMeta);
    } catch (blockchainErr) {
      console.error("Blockchain metadata fetch error:", blockchainErr);
      return NextResponse.json({ error: "Token not minted or RPC unreachable" }, { status: 404 });
    }
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filePath = path.join(METADATA_DIR, `${id}.json`);
  
  let debugInfo: any = {
    supabaseConfigured: isSupabaseConfigured(),
    env: {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      urlPrefix: (process.env.NEXT_PUBLIC_SUPABASE_URL || "").slice(0, 15)
    }
  };

  try {
    const body = await request.json();
    let finalBody = { ...body };

    // 1. If Supabase is configured and photo is provided, upload to Supabase Storage bucket
    if (isSupabaseConfigured() && supabase && body.image) {
      try {
        let buffer: Buffer;
        let mimeType = "image/jpeg";
        let fileExt = "jpg";

        if (body.image.startsWith("data:")) {
          mimeType = body.image.match(/[^:]\w+\/[\w\-+.]+(?=;base64)/)?.[0] || "image/jpeg";
          const base64Data = body.image.replace(/^data:image\/\w+;base64,/, "");
          buffer = Buffer.from(base64Data, "base64");
          fileExt = mimeType.split("/")[1] || "jpg";
        } else if (body.image.startsWith("http")) {
          // If it is a Discord CDN avatar or any external URL, download and persist it
          const highResUrl = getHighResDiscordUrl(body.image);
          const fetchRes = await fetch(highResUrl);
          if (fetchRes.ok) {
            const arrayBuffer = await fetchRes.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
            mimeType = fetchRes.headers.get("content-type") || "image/jpeg";
            fileExt = mimeType.split("/")[1] || "jpg";
          } else {
            throw new Error(`Failed to download external image: ${fetchRes.statusText}`);
          }
        } else {
          throw new Error("Invalid image format");
        }
        
        const storagePath = `avatars/${id}.${fileExt}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("tcg_images")
          .upload(storagePath, buffer, {
            contentType: mimeType,
            upsert: true
          });

        if (uploadErr) {
          console.error("Supabase Storage bucket upload error:", uploadErr);
          debugInfo.storageUploadError = uploadErr;
        } else {
          // Resolve short, lightning-fast CDN public URL
          const { data: { publicUrl } } = supabase.storage
            .from("tcg_images")
            .getPublicUrl(storagePath);

          const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;
          finalBody.image = cacheBustedUrl;
          finalBody.customImage = cacheBustedUrl;
          debugInfo.storageUploadSuccess = true;
          debugInfo.publicUrl = cacheBustedUrl;
        }
      } catch (uploadErr: any) {
        console.error("Failed to parse/download and upload image to Supabase storage:", uploadErr);
        debugInfo.storageException = uploadErr.message || String(uploadErr);
      }
    }


    // 2. Sync to Supabase Database (if configured)
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error: dbErr } = await supabase
          .from("tcg_metadata")
          .upsert({
            token_id: id,
            metadata: finalBody,
            updated_at: new Date().toISOString()
          });

        if (dbErr) {
          console.error("Supabase Database table upsert error:", dbErr);
          debugInfo.dbUpsertError = dbErr;
        } else {
          debugInfo.dbUpsertSuccess = true;
        }
      } catch (dbErr: any) {
        console.error("Failed to write to Supabase Database:", dbErr);
        debugInfo.dbException = dbErr.message || String(dbErr);
      }
    }

    // 3. Sync to secondary cloud KV (fallback persistence)
    try {
      await fetch(`${KV_URL}${id}`, {
        method: "POST",
        body: JSON.stringify(finalBody),
        headers: { "Content-Type": "application/json" }
      });
      debugInfo.kvSyncSuccess = true;
    } catch (kvErr: any) {
      console.error("Failed to write to cloud KV database:", kvErr);
      debugInfo.kvSyncError = kvErr.message || String(kvErr);
    }

    // 4. Save locally as fallback (will warning-log on Vercel read-only system without crashing)
    try {
      await ensureDirectoryExists();
      await fs.writeFile(filePath, JSON.stringify(finalBody, null, 2), "utf-8");
      debugInfo.localFileSuccess = true;
    } catch (fsErr: any) {
      console.warn("Local filesystem write skipped (Vercel serverless environment):", fsErr);
      debugInfo.localFileWarning = fsErr.message || String(fsErr);
    }

    return NextResponse.json({ success: true, metadata: finalBody, debug: debugInfo });
  } catch (err: any) {
    console.error("Failed to write metadata:", err);
    return NextResponse.json({ error: err.message || "Failed to write metadata", debug: debugInfo }, { status: 500 });
  }
}
