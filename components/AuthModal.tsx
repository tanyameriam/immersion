"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, type AuthMode } from "@/components/AuthContext";
import { SignInForm } from "@/components/SignInForm";
import { SignUpForm } from "@/components/SignUpForm";

export function AuthModal() {
  const { isOpen, mode, setMode, closeAuth } = useAuth();

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
            {mode === "sign-in" ? "Welcome back." : "Create your account."}
          </DialogTitle>
          <DialogDescription>
            {mode === "sign-in"
              ? "Sign in to your Layrrrd account."
              : "Join Layrrrd and start building your reading list."}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as AuthMode)}
        >
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="sign-in" className="flex-1">
              Sign In
            </TabsTrigger>
            <TabsTrigger value="sign-up" className="flex-1">
              Sign Up
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sign-in" className="mt-6">
            <SignInForm />
          </TabsContent>
          <TabsContent value="sign-up" className="mt-6">
            <SignUpForm />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
