import { Badge } from "@/components/ui/badge";
import { platformTokens } from "@/lib/format";

export function SourceBadges({ plateformes }: { plateformes: string }) {
  const tokens = platformTokens(plateformes);
  if (tokens.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {tokens.map((token) => (
        <Badge key={token} variant="outline" className="font-medium">
          {token}
        </Badge>
      ))}
    </div>
  );
}
