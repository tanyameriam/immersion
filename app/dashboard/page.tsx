"use client";

import { useEffect, useMemo, useState } from "react";
import Navigation from "@/components/Navigation";
import { RequireAuth } from "@/components/dashboard/RequireAuth";
import { BookmarksTab } from "@/components/dashboard/BookmarksTab";
import { SaveLinkBar } from "@/components/dashboard/SaveLinkBar";
import { ExtensionCallout } from "@/components/dashboard/ExtensionCallout";
import { RecommendedTab } from "@/components/dashboard/RecommendedTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/AuthContext";
import { useKnowledgeItems } from "@/hooks/use-knowledge-items";
import { useRecommendations } from "@/hooks/use-recommendations";
import { usePreferences } from "@/hooks/use-preferences";
import { LoadingDog } from "@/components/LoadingDog";
import { type Resource } from "@/lib/dashboard-data";

export default function DashboardPage() {
  const { user } = useAuth();
  const { resources, loading, remove, save, markRead } = useKnowledgeItems();
  const { recommendations, discover, web } = useRecommendations();
  const { prefs, save: savePrefs } = usePreferences();
  const [tab, setTab] = useState("bookmarks");
  const [bookmarks, setBookmarks] = useState<Resource[]>([]);

  // Server (Firestore) is the source of truth; sync in real saved items as
  // they load and finish AI processing.
  useEffect(() => {
    setBookmarks(resources);
  }, [resources]);

  // Negative feedback ("Not interested" / "Hide topic") lives on the user's
  // profile; the engine excludes it server-side on the next load, and this
  // filter hides it instantly without waiting for a refetch.
  const visible = useMemo(() => {
    const dismissed = new Set(prefs.dismissedUrls);
    const muted = new Set(prefs.mutedTopics.map((t) => t.toLowerCase()));
    const keep = (r: Resource) =>
      !dismissed.has(r.url) &&
      !(r.reasonTopic && muted.has(r.reasonTopic.toLowerCase()));
    return {
      recommendations: recommendations.filter(keep),
      discover: discover.filter(keep),
      web: web.filter(keep),
    };
  }, [recommendations, discover, web, prefs.dismissedUrls, prefs.mutedTopics]);

  // 👍 on a card = adopt its topic into stated interests (and un-mute it if
  // it was hidden before), so more of that topic feeds future matches.
  function handleLikeRecommendation(resource: Resource) {
    const topic = resource.reasonTopic;
    if (!topic) return;
    const same = (t: string) => t.toLowerCase() === topic.toLowerCase();
    const updates: {
      preferredTopics?: string[];
      mutedTopics?: string[];
    } = {};
    if (!prefs.preferredTopics.some(same)) {
      updates.preferredTopics = [...prefs.preferredTopics, topic];
    }
    if (prefs.mutedTopics.some(same)) {
      updates.mutedTopics = prefs.mutedTopics.filter((t) => !same(t));
    }
    if (Object.keys(updates).length > 0) void savePrefs(updates);
  }

  function handleDismissRecommendation(resource: Resource) {
    if (!prefs.dismissedUrls.includes(resource.url)) {
      void savePrefs({ dismissedUrls: [...prefs.dismissedUrls, resource.url] });
    }
  }

  // Muting a topic also drops it from stated interests, so the profile page
  // doesn't keep listing a topic the user explicitly hid.
  function handleMuteTopic(resource: Resource) {
    const topic = resource.reasonTopic;
    if (!topic) return;
    const same = (t: string) => t.toLowerCase() === topic.toLowerCase();
    if (prefs.mutedTopics.some(same)) return;
    void savePrefs({
      mutedTopics: [...prefs.mutedTopics, topic],
      preferredTopics: prefs.preferredTopics.filter((t) => !same(t)),
    });
  }

  // Bookmark a recommendation = actually save its URL (real save pipeline).
  // Engaging with a "discover" item also adopts its new topic into the user's
  // interests, so that topic starts feeding their matched recommendations.
  function handleBookmarkFromRecommendations(resource: Resource) {
    void save(resource.url);
    if (resource.kind === "discover" && resource.discoveryTopic) {
      const topic = resource.discoveryTopic;
      if (!prefs.preferredTopics.includes(topic)) {
        void savePrefs({ preferredTopics: [...prefs.preferredTopics, topic] });
      }
    }
  }

  return (
    <RequireAuth>
      <Navigation />
      <main className="mx-auto max-w-[1280px] px-6 pt-[72px] pb-24 md:px-10 xl:px-20">
        <div className="pt-10 md:pt-14">
          <p className="text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
            Dashboard
          </p>
          <h1 className="mt-6 text-4xl font-bold tracking-[-0.03em] text-foreground">
            Welcome back{user ? `, ${user.name.split(" ")[0]}` : ""}.
          </h1>
        </div>

        <Tabs value={tab} onValueChange={(v) => v && setTab(String(v))} className="mt-10">
          <TabsList variant="line">
            <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
            <TabsTrigger value="recommended">Recommended</TabsTrigger>
          </TabsList>

          <TabsContent value="bookmarks" className="mt-8 space-y-8">
            <ExtensionCallout />
            <SaveLinkBar onSave={save} />
            {loading && bookmarks.length === 0 ? (
              <LoadingDog label="Loading your bookmarks…" />
            ) : (
              <BookmarksTab
                items={bookmarks}
                setItems={setBookmarks}
                onExploreRecommendations={() => setTab("recommended")}
                onRemovePersist={(ids) => ids.forEach((id) => remove(id))}
                onMarkReadPersist={(ids) => ids.forEach((id) => markRead(id))}
              />
            )}
          </TabsContent>

          <TabsContent value="recommended" className="mt-8">
            <RecommendedTab
              items={visible.recommendations}
              discover={visible.discover}
              web={visible.web}
              onBookmark={handleBookmarkFromRecommendations}
              onLike={handleLikeRecommendation}
              onDismiss={handleDismissRecommendation}
              onMuteTopic={handleMuteTopic}
            />
          </TabsContent>
        </Tabs>
      </main>
    </RequireAuth>
  );
}
