import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getUserByOpenId } from "../db";
import { sdk } from "./sdk";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /** The owner's DB user ID — all data is stored under this ID regardless of who is logged in */
  workspaceOwnerId: number | null;
};

let _cachedWorkspaceOwnerId: number | null = null;
let _cacheResolvedAt = 0;
const CACHE_TTL_MS = 60_000; // retry every 60s until owner row exists

/** Hardcoded workspace owner ID. The DB has a single shared workspace under userId=1. */
const HARDCODED_OWNER_ID = 1;

async function getWorkspaceOwnerId(): Promise<number> {
  if (_cachedWorkspaceOwnerId !== null) return _cachedWorkspaceOwnerId;
  const now = Date.now();
  // Try resolving from env (in case the owner row uses a different ID), but fall back to hardcoded.
  if (ENV.ownerOpenId && now - _cacheResolvedAt >= CACHE_TTL_MS) {
    try {
      const owner = await getUserByOpenId(ENV.ownerOpenId);
      if (owner?.id) {
        _cachedWorkspaceOwnerId = owner.id;
        _cacheResolvedAt = now;
        return _cachedWorkspaceOwnerId;
      }
    } catch {
      /* fall through to hardcoded */
    }
    _cacheResolvedAt = now;
  }
  return HARDCODED_OWNER_ID;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const workspaceOwnerId = await getWorkspaceOwnerId();

  return {
    req: opts.req,
    res: opts.res,
    user,
    workspaceOwnerId,
  };
}
