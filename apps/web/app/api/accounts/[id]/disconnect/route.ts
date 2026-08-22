import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";

/** POST /api/accounts/:id/disconnect — removes stored credentials and deactivates the account (CLAUDE.md STEP 13). */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const account = await prisma.socialAccount.findUnique({ where: { id: params.id } });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  await prisma.platformCredential.deleteMany({ where: { socialAccountId: account.id } });
  await prisma.socialAccount.update({ where: { id: account.id }, data: { active: false } });

  return NextResponse.json({ ok: true });
}
