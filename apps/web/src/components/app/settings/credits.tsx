import { Badge } from "@openstarter/ui-web/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstarter/ui-web/components/table";
import { useQuery } from "@tanstack/react-query";
import { user } from "@/modules/user/lib/api";
import { m } from "@/paraglide/messages.js";

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString();
}

export function CreditsPage() {
  const creditsQuery = useQuery({ ...user.queries.credits() });

  const balance = creditsQuery.data?.balance ?? 0;
  const history = creditsQuery.data?.history ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{m["settings.credits.title"]()}</CardTitle>
          <CardDescription>{m["settings.credits.description"]()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="text-muted-foreground text-xs">{m["settings.credits.balance"]()}</p>
            <p className="font-bold text-3xl tabular-nums">
              {creditsQuery.isPending ? "—" : balance.toLocaleString()}
            </p>
          </div>

          {creditsQuery.error ? (
            <p className="text-destructive text-sm">{(creditsQuery.error as Error).message}</p>
          ) : null}

          {history.length > 0 ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{m["settings.credits.type"]()}</TableHead>
                    <TableHead>{m["settings.credits.credits"]()}</TableHead>
                    <TableHead>{m["settings.credits.remaining"]()}</TableHead>
                    <TableHead>{m["settings.credits.expires_at"]()}</TableHead>
                    <TableHead>{m["settings.credits.date"]()}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant={item.transactionType === "grant" ? "secondary" : "outline"}>
                          {item.transactionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{item.credits}</TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {item.remainingCredits}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(item.expiresAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {history.length === 0 && !creditsQuery.isPending ? (
            <p className="text-muted-foreground text-sm">{m["settings.credits.no_records"]()}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
