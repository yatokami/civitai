import { TRPCError } from '@trpc/server';

import { prisma } from '~/server/db/client';
import {
  convertToCommentHandler,
  deleteUserReviewHandler,
  getReviewCommentsHandler,
  getReviewCommentsCountHandler,
  getReviewDetailsHandler,
  getReviewReactionsHandler,
  getReviewsInfiniteHandler,
  setTosViolationHandler,
  toggleExcludeHandler,
  toggleLockHandler,
  toggleReactionHandler,
  upsertReviewHandler,
} from '~/server/controllers/review.controller';
import { getByIdSchema } from '~/server/schema/base.schema';
import {
  getAllReviewSchema,
  getReviewReactionsSchema,
  reviewUpsertSchema,
  toggleReactionInput,
} from '~/server/schema/review.schema';
import {
  guardedProcedure,
  middleware,
  protectedProcedure,
  publicProcedure,
  router,
} from '~/server/trpc';
import { throwAuthorizationError } from '~/server/utils/errorHandling';

const isOwnerOrModerator = middleware(async ({ ctx, next, input }) => {
  if (!ctx?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });

  const { id } = input as { id: number };
  const userId = ctx.user.id;
  let ownerId: number = userId;
  if (id) {
    const isModerator = ctx?.user?.isModerator;
    ownerId = (await prisma.review.findUnique({ where: { id } }))?.userId ?? 0;
    if (!isModerator && ownerId) {
      if (ownerId !== userId) throw throwAuthorizationError();
    }
  }

  return next({
    ctx: {
      // infers the `session` as non-nullable
      ...ctx,
      user: ctx.user,
      ownerId,
    },
  });
});

const isLocked = middleware(async ({ ctx, next, input }) => {
  if (!ctx?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });

  const { id } = input as { id: number };
  const isModerator = ctx.user.isModerator;
  const review = await prisma.review.findFirst({ where: { id } });
  const locked = isModerator ? false : review?.locked ?? false;

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      locked,
    },
  });
});

export const reviewRouter = router({
  getAll: publicProcedure.input(getAllReviewSchema).query(getReviewsInfiniteHandler),
  getReactions: publicProcedure.input(getReviewReactionsSchema).query(getReviewReactionsHandler),
  getDetail: publicProcedure.input(getByIdSchema).query(getReviewDetailsHandler),
  getCommentsById: publicProcedure.input(getByIdSchema).query(getReviewCommentsHandler),
  getCommentsCount: publicProcedure.input(getByIdSchema).query(getReviewCommentsCountHandler),
  upsert: guardedProcedure
    .input(reviewUpsertSchema)
    .use(isOwnerOrModerator)
    .use(isLocked)
    .mutation(upsertReviewHandler),
  delete: protectedProcedure
    .input(getByIdSchema)
    .use(isOwnerOrModerator)
    .mutation(deleteUserReviewHandler),
  toggleReaction: protectedProcedure.input(toggleReactionInput).mutation(toggleReactionHandler),
  toggleExclude: protectedProcedure.input(getByIdSchema).mutation(toggleExcludeHandler),
  convertToComment: protectedProcedure
    .input(getByIdSchema)
    .use(isOwnerOrModerator)
    .mutation(convertToCommentHandler),
  toggleLock: protectedProcedure
    .input(getByIdSchema)
    .use(isOwnerOrModerator)
    .mutation(toggleLockHandler),
  setTosViolation: protectedProcedure.input(getByIdSchema).mutation(setTosViolationHandler),
});
