import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-4xl">Immersion</CardTitle>
          <CardDescription className="text-lg">
            Your content curation app — coming together.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            This is the starter baseline. Build your features here in{" "}
            <code>app/</code>, push to GitHub, and Vercel will deploy
            automatically.
          </p>
          <Button>Get started</Button>
        </CardContent>
      </Card>
    </main>
  );
}
