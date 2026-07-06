"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWaitlist } from "@/components/WaitlistContext";

type Status = "idle" | "submitting" | "success" | "error";

export function WaitlistModal() {
  const { isOpen, closeWaitlist } = useWaitlist();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  function reset() {
    setEmail("");
    setStatus("idle");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setStatus("error");
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setError("Something went wrong.");
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeWaitlist();
          reset();
        }
      }}
    >
      <DialogContent className="max-w-md p-8 md:p-10">
        {status === "success" ? (
          <DialogHeader>
            <DialogTitle className="font-sans text-2xl normal-case tracking-[-0.03em] font-bold text-foreground">
              You&apos;re on the list
            </DialogTitle>
            <DialogDescription className="text-[17px] text-muted-foreground">
              We&apos;ll be in touch.
            </DialogDescription>
          </DialogHeader>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-sans text-2xl normal-case tracking-[-0.03em] font-bold text-foreground">
                Get early access.
              </DialogTitle>
              <DialogDescription>
                Join the waitlist and we&apos;ll reach out when Layrrrd opens
                up.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                aria-invalid={status === "error"}
              />
              {status === "error" && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                type="submit"
                disabled={status === "submitting"}
                className="w-full"
              >
                {status === "submitting" ? "Joining…" : "Join waitlist"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
