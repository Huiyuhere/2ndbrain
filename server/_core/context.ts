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

async function getWorkspaceOwnerId(): Promise<number | null> {
  const now = Date.now();
  // Return cached value if it's a valid ID, or if we checked recently
  if (_cachedWorkspaceOwnerId !== null) return _cachedWorkspaceOwnerId;
  if (now - _cacheResolvedAt < CACHE_TTL_MS) return null;
  if (!ENV.ownerOpenId) return null;
  const owner = await getUserByOpenId(ENV.ownerOpenId);
  _cachedWorkspaceOwnerId = owner?.id ?? null;
  _cacheResolvedAt = now;
  return _cachedWorkspaceOwnerId;
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
