"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Blocks, MessageCircle, MessagesSquare, Bell } from "lucide-react";
import Navigation from "@/components/Navigation";
import { RequireAuth } from "@/components/dashboard/RequireAuth";
import { useAuth } from "@/components/AuthContext";
import { usePreferences } from "@/hooks/use-preferences";
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
import { INTEREST_GROUPS } from "@/lib/constants";

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
                  return (
                    <div key={option} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={selected.has(option)}
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
  const { prefs, loaded, save } = usePreferences();
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("email");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [day, setDay] = useState("Monday");
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    if (loaded) {
      setDeliveryMethod(prefs.notificationPreference);
      setTelegramUsername(prefs.telegramChatId);
      setDay(prefs.notificationDay);
    }
  }, [
    loaded,
    prefs.notificationPreference,
    prefs.telegramChatId,
    prefs.notificationDay,
  ]);

  async function handleSave() {
    await save({
      notificationPreference: deliveryMethod,
      telegramChatId: telegramUsername,
      notificationDay: day,
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
          <div className="space-y-2">
            <Label htmlFor="profile-telegram-username">
              Telegram Username
            </Label>
            <Input
              id="profile-telegram-username"
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
              placeholder="@username"
            />
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="profile-email">Registered Email</Label>
        <Input id="profile-email" value={user?.email ?? ""} readOnly disabled />
      </CardContent>
      <CardFooter className="gap-3">
        <Button size="sm" variant="outline">
          Change Password
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            logout();
            router.push("/");
          }}
        >
          Delete Account
        </Button>
      </CardFooter>
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
