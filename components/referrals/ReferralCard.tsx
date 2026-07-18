"use client";

import { useEffect, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";

type ReferralResponse = {
  code: string;
  link: string;
  stats: {
    signupCount: number;
    paidCount: number;
  };
};

export function ReferralCard() {
  const [data, setData] = useState<ReferralResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReferral() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/referrals/me");
      if (!res.ok) throw new Error(`Referral API ${res.status}`);
      setData((await res.json()) as ReferralResponse);
    } catch (err) {
      console.error("Failed to load referral link", err);
      setError("Could not load your referral link. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReferral();
  }, []);

  async function copyLink() {
    if (!data?.link) return;
    try {
      await navigator.clipboard.writeText(data.link);
      toast.success("Referral link copied");
    } catch (err) {
      console.error("Failed to copy referral link", err);
      toast.error("Could not copy the link");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Referrals</CardTitle>
        <CardDescription>
          Share Layrrrd with people who save more than they can revisit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="profile-referral-link">Your referral link</Label>
          <div className="flex gap-2">
            <Input
              id="profile-referral-link"
              value={data?.link ?? (loading ? "Loading..." : "")}
              readOnly
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={!data?.link}
              onClick={copyLink}
              aria-label="Copy referral link"
            >
              <Copy className="size-4" />
            </Button>
          </div>
          {data?.code && (
            <p className="text-sm text-muted-foreground">
              Referral code:{" "}
              <span className="font-medium text-foreground">{data.code}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="border border-border p-4">
            <p className="text-2xl font-bold tracking-[-0.03em] text-foreground">
              {data?.stats.signupCount ?? 0}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Referred signups
            </p>
          </div>
          <div className="border border-border p-4">
            <p className="text-2xl font-bold tracking-[-0.03em] text-foreground">
              {data?.stats.paidCount ?? 0}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Referred paid users
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
      {error && (
        <CardFooter>
          <Button type="button" size="sm" variant="outline" onClick={loadReferral}>
            <RefreshCw data-icon="inline-start" />
            Retry
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
