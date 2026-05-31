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

/** Public dashboard procedure — no auth, just resolves the shared workspace owner ID. */
export const workspaceProcedure = t.procedure.use(requireWorkspace);

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
