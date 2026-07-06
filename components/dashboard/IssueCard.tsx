import { BookOpen, Layers } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WeeklyIssue } from "@/lib/dashboard-data";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function IssueCard({ issue }: { issue: WeeklyIssue }) {
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <Badge variant="secondary">Issue #{issue.weekNumber}</Badge>
        <CardTitle className="mt-2 normal-case tracking-normal">
          {issue.title}
        </CardTitle>
        <CardDescription className="mt-1">
          Published {formatDate(issue.publishDate)}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Layers className="size-3.5" />
          {issue.resourceCount} resources
        </span>
      </CardContent>

      <CardFooter>
        <Button
          size="sm"
          className="w-full"
          nativeButton={false}
          render={<a href={issue.url} target="_blank" rel="noreferrer" />}
        >
          <BookOpen data-icon="inline-start" />
          Read Issue
        </Button>
      </CardFooter>
    </Card>
  );
}
