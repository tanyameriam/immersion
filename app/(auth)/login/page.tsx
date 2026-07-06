"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);

  // Already signed in → go to the dashboard.
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function handleSignIn() {
    setSigningIn(true);
    try {
      await signInWithGoogle();
      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      toast.error("Sign-in failed. Please try again.");
      setSigningIn(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="bg-primary/10 text-primary mb-2 flex size-12 items-center justify-center rounded-xl">
            <Layers className="size-6" />
          </div>
          <CardTitle className="text-3xl">Layrrrd</CardTitle>
          <CardDescription className="text-base">
            Save anything. AI understands everything.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={handleSignIn}
            disabled={signingIn || loading}
          >
            {signingIn ? "Signing in…" : "Continue with Google"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
