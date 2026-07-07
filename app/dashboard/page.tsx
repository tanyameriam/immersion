"use client";

import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import { RequireAuth } from "@/components/dashboard/RequireAuth";
import { BookmarksTab } from "@/components/dashboard/BookmarksTab";
import { SaveLinkBar } from "@/components/dashboard/SaveLinkBar";
import { RecommendedTab } from "@/components/dashboard/RecommendedTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/AuthContext";
import { useKnowledgeItems } from "@/hooks/use-knowledge-items";
import { useRecommendations } from "@/hooks/use-recommendations";
import { type Resource } from "@/lib/dashboard-data";

export default function DashboardPage() {
  const { user } = useAuth();
  const { resources, remove, save } = useKnowledgeItems();
  const { recommendations } = useRecommendations();
  const [tab, setTab] = useState("bookmarks");
  const [bookmarks, setBookmarks] = useState<Resource[]>([]);

  // Server (Firestore) is the source of truth; sync in real saved items as
  // they load and finish AI processing.
  useEffect(() => {
    setBookmarks(resources);
  }, [resources]);

  // Bookmark a recommendation = actually save its URL (real save pipeline).
  function handleBookmarkFromRecommendations(resource: Resource) {
    void save(resource.url);
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
            <SaveLinkBar onSave={save} />
            <BookmarksTab
              items={bookmarks}
              setItems={setBookmarks}
              onExploreRecommendations={() => setTab("recommended")}
              onRemovePersist={(ids) => ids.forEach((id) => remove(id))}
            />
          </TabsContent>

          <TabsContent value="recommended" className="mt-8">
            <RecommendedTab
              items={recommendations}
              onBookmark={handleBookmarkFromRecommendations}
            />
          </TabsContent>
        </Tabs>
      </main>
    </RequireAuth>
  );
}
