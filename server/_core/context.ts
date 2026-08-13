import type { SessionUser } from "../../drizzle/schema";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getPasswordSessionUser } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: SessionUser | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const user = await getPasswordSessionUser(opts.req);
  return { req: opts.req, res: opts.res, user };
}
