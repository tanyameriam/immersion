"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { auth } from "@/lib/firebase/client";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const ratings = [1, 2, 3, 4, 5];

/** Event name other components dispatch to pop the feedback form open. */
export const OPEN_FEEDBACK_EVENT = "layrrrd:open-feedback";

/** Open the floating feedback widget from anywhere in the app. */
export function openFeedback() {
  window.dispatchEvent(new Event(OPEN_FEEDBACK_EVENT));
}

export function FeedbackWidget() {
  const { user, hydrated } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;

    setSubmitted(false);
  }, [open]);

  // Let other surfaces (e.g. the interests picker's "request a topic" link)
  // pop the form open without threading state through the tree.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_FEEDBACK_EVENT, handler);
    return () => window.removeEventListener(OPEN_FEEDBACK_EVENT, handler);
  }, []);

  if (!hydrated) return null;

  async function submitFeedback() {
    if (!rating || submitting) return;

    setSubmitting(true);

    const payload = {
      rating,
      comment: comment.trim(),
      email: user?.email ?? "",
      page: window.location.href,
    };

    try {
      const headers = new Headers({ "Content-Type": "application/json" });
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        headers.set("Authorization", `Bearer ${await firebaseUser.getIdToken()}`);
      }

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Feedback request failed");

      setSubmitted(true);
      track("feedback_submitted", { rating, signed_in: Boolean(user) });

      window.setTimeout(() => {
        setOpen(false);
        setRating(null);
        setComment("");
        setSubmitted(false);
      }, 1400);
    } catch (err) {
      console.error("Feedback submission failed", err);
      toast.error("Feedback did not send", {
        description: "Please try again in a moment.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed right-5 bottom-5 z-50">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              size="sm"
              className="h-11 gap-2 px-5 normal-case tracking-normal shadow-lg"
            >
              <MessageCircle className="size-4" />
              Feedback
            </Button>
          }
        />
        <PopoverContent
          align="end"
          side="top"
          sideOffset={12}
          className="w-[min(calc(100vw-2.5rem),320px)] gap-4 p-4 shadow-xl"
        >
          {submitted ? (
            <div className="py-6 text-center text-sm font-medium">
              Thanks. That helps a lot.
            </div>
          ) : (
            <>
              <PopoverHeader>
                <PopoverTitle className="normal-case tracking-normal">
                  Quick feedback
                </PopoverTitle>
              </PopoverHeader>

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Rate your experience with Layrrrd so far
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {ratings.map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={rating === value ? "default" : "outline"}
                      size="icon-sm"
                      aria-pressed={rating === value}
                      onClick={() => setRating(value)}
                      className="text-sm tracking-normal"
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>

              <label className="space-y-2">
                <span className="block text-xs text-muted-foreground">
                  What did not work well or felt confusing?
                </span>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Type here..."
                  rows={3}
                  className={cn(
                    "min-h-20 w-full resize-none border border-input bg-muted px-3 py-2 text-sm text-foreground",
                    "placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
                  )}
                />
              </label>

              <Button
                type="button"
                disabled={!rating || submitting}
                onClick={submitFeedback}
                className="w-full"
              >
                {submitting ? "Sending..." : "Send feedback"}
              </Button>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
