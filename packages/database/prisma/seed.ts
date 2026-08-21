import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "founder@example.com" },
    update: {},
    create: { email: "founder@example.com", name: "Founder" },
  });

  const workspace = await prisma.workspace.upsert({
    where: { id: "workspace_demo" },
    update: {},
    create: {
      id: "workspace_demo",
      name: "Demo Workspace",
      users: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  await prisma.brandPersona.upsert({
    where: { id: "persona_demo" },
    update: {},
    create: {
      id: "persona_demo",
      workspaceId: workspace.id,
      name: "AI Productivity Persona",
      niche: "AI productivity",
      audience: "Japanese office workers",
      tone: ["friendly", "practical", "concise"],
      avoid: ["fake income claims", "excessive hype"],
      ctaStyle: "soft",
    },
  });

  await prisma.socialAccount.upsert({
    where: { platform_externalId: { platform: "THREADS", externalId: "mock_threads_demo" } },
    update: {},
    create: {
      workspaceId: workspace.id,
      platform: "THREADS",
      externalId: "mock_threads_demo",
      username: "demo_threads",
      displayName: "Demo Threads Account",
      approvalMode: "MANUAL",
    },
  });

  console.log(`Seeded workspace ${workspace.id}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
