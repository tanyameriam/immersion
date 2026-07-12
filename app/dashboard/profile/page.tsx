"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { Blocks, MessageCircle, MessagesSquare, Bell } from "lucide-react";
import Navigation from "@/components/Navigation";
import { RequireAuth } from "@/components/dashboard/RequireAuth";
import { TelegramConnect } from "@/components/TelegramConnect";
import { useAuth } from "@/components/AuthContext";
import { usePreferences } from "@/hooks/use-preferences";
import { apiFetch } from "@/lib/api-client";
import { auth } from "@/lib/firebase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
import { INTEREST_GROUPS, isTopicAvailable } from "@/lib/constants";

type DeliveryMethod = "email" | "telegram";

function useSavedFlash() {
  const [saved, setSaved] = useState(false);
  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
  return { saved, flash };
}

function PersonalInformationCard() {
  const { user } = useAuth();
  const { prefs, loaded, save } = usePreferences();
  const [fullName, setFullName] = useState(user?.name ?? "");
  const [profession, setProfession] = useState("designer");
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    if (loaded && prefs.name) setFullName(prefs.name);
  }, [loaded, prefs.name]);

  async function handleSave() {
    await save({ name: fullName });
    flash();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Full Name</Label>
          <Input
            id="profile-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-profession">Profession</Label>
          <Select value={profession} onValueChange={(v) => setProfession(v ?? "")}>
            <SelectTrigger id="profile-profession" className="w-full">
              <SelectValue placeholder="Select your profession" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="designer">Designer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      <CardFooter className="gap-3">
        <Button size="sm" onClick={handleSave}>
          Save Changes
        </Button>
        {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
      </CardFooter>
    </Card>
  );
}

function RecommendationPreferencesCard() {
  const { prefs, loaded, save } = usePreferences();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    if (loaded) setSelected(new Set(prefs.preferredTopics));
  }, [loaded, prefs.preferredTopics]);

  async function handleSave() {
    await save({ preferredTopics: [...selected] });
    flash();
  }

  function toggle(option: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(option);
      else next.delete(option);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommendation Preferences</CardTitle>
        <CardDescription>What would you like to discover?</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {INTEREST_GROUPS.map((group) => (
            <div key={group.label} className="space-y-3">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.topics.map((option) => {
                  const id = `interest-${option}`;
                  const available = isTopicAvailable(option);
                  return (
                    <div
                      key={option}
                      className={
                        "flex items-center gap-2" +
                        (available ? "" : " cursor-default opacity-50")
                      }
                      title={available ? undefined : "Coming soon"}
                    >
                      <Checkbox
                        id={id}
                        checked={selected.has(option)}
                        disabled={!available}
                        onCheckedChange={(checked) =>
                          toggle(option, checked === true)
                        }
                      />
                      <Label htmlFor={id}>{option}</Label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="gap-3">
        <Button size="sm" onClick={handleSave}>
          Save Changes
        </Button>
        {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
      </CardFooter>
    </Card>
  );
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function NewsletterDeliveryCard() {
  const { user } = useAuth();
  const { prefs, loaded, save, reload } = usePreferences();
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("email");
  const [day, setDay] = useState("Monday");
  const [nudgesOn, setNudgesOn] = useState(true);
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    if (loaded) {
      setDeliveryMethod(prefs.notificationPreference);
      setDay(prefs.notificationDay);
      setNudgesOn(prefs.botNudges !== "off");
    }
  }, [loaded, prefs.notificationPreference, prefs.notificationDay, prefs.botNudges]);

  async function handleSave() {
    await save({
      notificationPreference: deliveryMethod,
      notificationDay: day,
      botNudges: nudgesOn ? "on" : "off",
    });
    flash();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Newsletter Delivery</CardTitle>
        <CardDescription>Receive Layrrrd</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={deliveryMethod}
          onValueChange={(v) => setDeliveryMethod(v as DeliveryMethod)}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="email" id="profile-delivery-email" />
            <Label htmlFor="profile-delivery-email">Email</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="telegram" id="profile-delivery-telegram" />
            <Label htmlFor="profile-delivery-telegram">Telegram</Label>
          </div>
        </RadioGroup>

        {deliveryMethod === "email" ? (
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        ) : (
          <div className="space-y-4">
            <TelegramConnect
              chatId={prefs.telegramChatId}
              refresh={reload}
              onDisconnect={() => void save({ telegramChatId: "" })}
            />
            <div className="flex items-start gap-2">
              <Checkbox
                id="rudolf-nudges"
                className="mt-0.5"
                checked={nudgesOn}
                onCheckedChange={(checked) => setNudgesOn(checked === true)}
              />
              <div>
                <Label htmlFor="rudolf-nudges">Rudolf&apos;s picks</Label>
                <p className="text-sm text-muted-foreground">
                  Let Rudolf text you a couple of fresh picks between digests.
                  You can also send /mute or /unmute in the chat.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="delivery-day">Delivery day</Label>
          <Select value={day} onValueChange={(v) => v && setDay(v)}>
            <SelectTrigger id="delivery-day" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Your weekly digest arrives every {day}.
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
            More delivery options
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { name: "Slack", Icon: Blocks },
              { name: "WhatsApp", Icon: MessageCircle },
              { name: "Discord", Icon: MessagesSquare },
              { name: "Push", Icon: Bell },
            ].map(({ name, Icon }) => (
              <span
                key={name}
                title="Coming soon"
                className="flex cursor-default items-center gap-1.5 border border-border px-3 py-1.5 text-sm text-muted-foreground opacity-60"
              >
                <Icon className="size-4" />
                {name}
                <span className="text-[10px] uppercase tracking-wide">soon</span>
              </span>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-3">
        <Button size="sm" onClick={handleSave}>
          Save Changes
        </Button>
        {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
      </CardFooter>
    </Card>
  );
}

function AccountCard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [passwordStatus, setPasswordStatus] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Password changes only apply to email/password sign-ins; Google-only
  // accounts have no password to change.
  const hasPassword =
    auth.currentUser?.providerData.some((p) => p.providerId === "password") ??
    false;

  async function handleChangePassword() {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      setPasswordStatus(
        `Password reset link sent to ${user.email} — check your inbox.`,
      );
    } catch (err) {
      console.error("Password reset failed", err);
      setPasswordStatus("Couldn't send the reset email. Try again in a moment.");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await apiFetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete API ${res.status}`);
      logout();
      router.push("/");
    } catch (err) {
      console.error("Account deletion failed", err);
      setDeleteError("Couldn't delete your account. Try again in a moment.");
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="profile-email">Registered Email</Label>
        <Input id="profile-email" value={user?.email ?? ""} readOnly disabled />
        {!hasPassword && (
          <p className="text-sm text-muted-foreground">
            You sign in with Google, so there&apos;s no password to change.
          </p>
        )}
        {passwordStatus && (
          <p className="text-sm text-muted-foreground">{passwordStatus}</p>
        )}
      </CardContent>
      <CardFooter className="gap-3">
        {hasPassword && (
          <Button size="sm" variant="outline" onClick={handleChangePassword}>
            Change Password
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            setConfirmText("");
            setDeleteError("");
            setDeleteOpen(true);
          }}
        >
          Delete Account
        </Button>
      </CardFooter>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your account, every bookmark and
              summary, and your digest history. There is no undo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-delete">
              Type <span className="font-bold">DELETE</span> to confirm
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
            {deleteError && (
              <p className="text-sm text-destructive">{deleteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "DELETE" || deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function ProfileSettingsPage() {
  return (
    <RequireAuth>
      <Navigation />
      <main className="mx-auto max-w-[720px] px-6 pt-[72px] pb-24 md:px-10">
        <div className="pt-10 md:pt-14">
          <p className="text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
            Account
          </p>
          <h1 className="mt-6 text-4xl font-bold tracking-[-0.03em] text-foreground">
            Profile Settings
          </h1>
        </div>

        <div className="mt-10 space-y-8">
          <PersonalInformationCard />
          <RecommendationPreferencesCard />
          <NewsletterDeliveryCard />
          <AccountCard />
        </div>
      </main>
    </RequireAuth>
  );
}
