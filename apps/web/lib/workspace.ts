import { prisma } from "./db";

/**
 * MVP is single-tenant (no auth yet — Phase 3 in CLAUDE.md section 36).
 * Ensures a default workspace/persona/account exist so the app works from a
 * fresh database without a manual seed step, then reuses them.
 */
export async function getDefaultWorkspace() {
  const existing = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;

  return prisma.workspace.create({
    data: {
      id: "workspace_demo",
      name: "Demo Workspace",
      personas: {
        create: {
          id: "persona_demo",
          name: "AI Productivity Persona",
          niche: "AI productivity",
          audience: "Japanese office workers",
          tone: ["friendly", "practical", "concise"],
          avoid: ["fake income claims", "excessive hype"],
          ctaStyle: "soft",
        },
      },
      accounts: {
        create: {
          platform: "THREADS",
          externalId: "mock_threads_demo",
          username: "demo_threads",
          displayName: "Demo Threads Account",
          approvalMode: "MANUAL",
        },
      },
    },
  });
}

export async function getDefaultPersona(workspaceId: string) {
  const persona = await prisma.brandPersona.findFirst({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
  if (persona) return persona;
  throw new Error(`No BrandPersona found for workspace ${workspaceId}`);
}

export async function getDefaultSocialAccount(workspaceId: string) {
  const account = await prisma.socialAccount.findFirst({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
  if (account) return account;
  throw new Error(`No SocialAccount found for workspace ${workspaceId}`);
}
