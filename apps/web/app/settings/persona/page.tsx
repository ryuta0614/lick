import { prisma } from "../../../lib/db";
import { getDefaultWorkspace } from "../../../lib/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PersonaSettingsPage() {
  const workspace = await getDefaultWorkspace();
  const personas = await prisma.brandPersona.findMany({ where: { workspaceId: workspace.id } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Brand Persona</h1>
        <p className="text-sm text-muted-foreground">Applied to every generation call (CLAUDE.md section 16).</p>
      </div>

      {personas.map((persona) => (
        <Card key={persona.id}>
          <CardHeader>
            <CardTitle>{persona.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Niche:</span> {persona.niche}
            </p>
            <p>
              <span className="text-muted-foreground">Audience:</span> {persona.audience}
            </p>
            <div className="flex flex-wrap gap-1">
              {(persona.tone as string[]).map((t) => (
                <Badge key={t} tone="muted">
                  {t}
                </Badge>
              ))}
            </div>
            {persona.avoid && (
              <p>
                <span className="text-muted-foreground">Avoid:</span> {(persona.avoid as string[]).join(", ")}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">CTA style:</span> {persona.ctaStyle}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
