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
          <CardTitle className="text-4xl">Layrrrd</CardTitle>
          <CardDescription className="text-lg">
            Save anything. AI understands everything.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Save any page in one click. Layrrrd reads it for you and turns it
            into a summary, key topics, and a weekly digest — so you consume
            less and learn more.
          </p>
          <Button>Continue with Google</Button>
        </CardContent>
      </Card>
    </main>
  );
}
