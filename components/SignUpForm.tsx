"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/AuthContext";
import { DESIGN_ROLES, slugify } from "@/lib/constants";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type DeliveryMethod = "email" | "telegram";

type Errors = Partial<
  Record<
    | "fullName"
    | "profession"
    | "email"
    | "password"
    | "confirmPassword"
    | "deliveryMethod"
    | "telegramUsername"
    | "agreeToTerms",
    string
  >
>;

export function SignUpForm() {
  const { setMode, login, closeAuth } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [profession, setProfession] = useState("designer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>("email");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [designRole, setDesignRole] = useState<string | undefined>(undefined);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "submitting">("idle");

  function validate(): Errors {
    const next: Errors = {};
    if (!fullName.trim()) next.fullName = "Full name is required.";
    if (!profession) next.profession = "Profession is required.";
    if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    if (password.length < 8)
      next.password = "Password must be at least 8 characters.";
    if (confirmPassword !== password)
      next.confirmPassword = "Passwords do not match.";
    if (!deliveryMethod) next.deliveryMethod = "Delivery method is required.";
    if (deliveryMethod === "telegram" && !telegramUsername.trim())
      next.telegramUsername = "Telegram username is required.";
    if (!agreeToTerms)
      next.agreeToTerms = "You must agree to the Terms & Privacy Policy.";
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus("submitting");
    // No backend wired up yet — simulate the round trip.
    await new Promise((resolve) => setTimeout(resolve, 500));
    login({ name: fullName.trim(), email }, { remember: true });
    closeAuth();
    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-6">
        <p className="text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
          Account Information
        </p>

        <div className="space-y-2">
          <Label htmlFor="signup-name">Full Name</Label>
          <Input
            id="signup-name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ada Lovelace"
            aria-invalid={!!errors.fullName}
          />
          {errors.fullName && (
            <p className="text-sm text-destructive">{errors.fullName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-profession">Profession</Label>
          <Select
            value={profession}
            onValueChange={(value) => setProfession(value ?? "")}
          >
            <SelectTrigger id="signup-profession" className="w-full">
              <SelectValue placeholder="Select your profession" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="designer">Designer</SelectItem>
            </SelectContent>
          </Select>
          {errors.profession && (
            <p className="text-sm text-destructive">{errors.profession}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-email">Email Address</Label>
          <Input
            id="signup-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            aria-invalid={!!errors.password}
          />
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-confirm-password">Confirm Password</Label>
          <Input
            id="signup-confirm-password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            aria-invalid={!!errors.confirmPassword}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">
              {errors.confirmPassword}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
          Newsletter Delivery
        </p>

        <RadioGroup
          value={deliveryMethod}
          onValueChange={(v) => setDeliveryMethod(v as DeliveryMethod)}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="email" id="delivery-email" />
            <Label htmlFor="delivery-email">Email</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="telegram" id="delivery-telegram" />
            <Label htmlFor="delivery-telegram">Telegram (Coming Soon)</Label>
          </div>
        </RadioGroup>

        {deliveryMethod === "email" ? (
          <p className="text-sm text-muted-foreground">
            Your weekly digest will be delivered to your account email.
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="telegram-username">Telegram Username</Label>
            <Input
              id="telegram-username"
              required
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
              placeholder="@username"
              aria-invalid={!!errors.telegramUsername}
            />
            {errors.telegramUsername && (
              <p className="text-sm text-destructive">
                {errors.telegramUsername}
              </p>
            )}
          </div>
        )}
        {errors.deliveryMethod && (
          <p className="text-sm text-destructive">{errors.deliveryMethod}</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
          Personalization (Optional)
        </p>
        <Label htmlFor="design-role">Design Role</Label>
        <Select
          value={designRole}
          onValueChange={(value) => setDesignRole(value ?? undefined)}
        >
          <SelectTrigger id="design-role" className="w-full">
            <SelectValue placeholder="Select your role (optional)" />
          </SelectTrigger>
          <SelectContent>
            {DESIGN_ROLES.map((role) => (
              <SelectItem key={role} value={slugify(role)}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <Checkbox
            id="agree-to-terms"
            className="mt-0.5"
            checked={agreeToTerms}
            onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
            aria-invalid={!!errors.agreeToTerms}
          />
          <Label htmlFor="agree-to-terms">
            I agree to the{" "}
            <Link href="/terms" className="underline underline-offset-4">
              Terms
            </Link>{" "}
            &{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </Label>
        </div>
        {errors.agreeToTerms && (
          <p className="text-sm text-destructive">{errors.agreeToTerms}</p>
        )}
      </div>

      <Button type="submit" disabled={status === "submitting"} className="w-full">
        {status === "submitting" ? "Creating account…" : "Create Account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => setMode("sign-in")}
          className="text-foreground underline underline-offset-4"
        >
          Sign In
        </button>
      </p>
    </form>
  );
}
