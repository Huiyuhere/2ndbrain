import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/** Ensures the workspace owner ID is resolved; throws a clear error if the owner hasn't signed in yet */
const requireWorkspace = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.workspaceOwnerId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Workspace not ready — please sign in as the owner first.",
    });
  }
  return next({ ctx: { ...ctx, workspaceOwnerId: ctx.workspaceOwnerId } });
});

/** Email allowlist for accessing the dashboard. */
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS ?? "tuhuiyu@manus.ai,t.reneehuiyu@gmail.com")
  .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

const requireAllowedEmail = t.middleware(async opts => {
  const { ctx, next } = opts;
  const email = ctx.user?.email?.toLowerCase();
  if (!email || !ALLOWED_EMAILS.includes(email)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied. This dashboard is private." });
  }
  return next({ ctx });
});

/** Use this for all data procedures — requires auth, allowlisted email, and workspace owner resolved. */
export const workspaceProcedure = t.procedure.use(requireUser).use(requireAllowedEmail).use(requireWorkspace);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
