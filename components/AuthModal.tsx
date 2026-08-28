"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/AuthContext";
import { SignInForm } from "@/components/SignInForm";
import { VerifyEmailForm } from "@/components/VerifyEmailForm";

export function AuthModal() {
  const { isOpen, closeAuth, mode, needsVerification } = useAuth();
  const signingUp = mode === "sign-up";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeAuth();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto p-8 md:p-10">
        <DialogHeader>
          <DialogTitle className="font-sans text-2xl normal-case tracking-[-0.03em] font-bold text-foreground">
            {needsVerification
              ? "Confirm your email."
              : signingUp
                ? "Create your account."
                : "Welcome back."}
          </DialogTitle>
          <DialogDescription>
            {needsVerification
              ? "One quick step before you start."
              : signingUp
                ? "Start your Layrrrd account."
                : "Sign in to your Layrrrd account."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          {needsVerification ? <VerifyEmailForm /> : <SignInForm />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
