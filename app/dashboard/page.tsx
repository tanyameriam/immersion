"use client";

import { useState } from "react";
import Navigation from "@/components/Navigation";
import { RequireAuth } from "@/components/dashboard/RequireAuth";
import { BookmarksTab } from "@/components/dashboard/BookmarksTab";
import { RecommendedTab } from "@/components/dashboard/RecommendedTab";
import { WeeklyIssuesTab } from "@/components/dashboard/WeeklyIssuesTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/AuthContext";
import {
  bookmarks as initialBookmarks,
  type Resource,
} from "@/lib/dashboard-data";

export default function DashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("bookmarks");
  const [bookmarks, setBookmarks] = useState<Resource[]>(initialBookmarks);

  function handleBookmarkFromRecommendations(resource: Resource) {
    setBookmarks((prev) => {
      if (prev.some((item) => item.id === resource.id)) return prev;
      return [
        { ...resource, savedDate: new Date().toISOString() },
        ...prev,
      ];
    });
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
            <TabsTrigger value="issues">Weekly Issues</TabsTrigger>
          </TabsList>

          <TabsContent value="bookmarks" className="mt-8">
            <BookmarksTab
              items={bookmarks}
              setItems={setBookmarks}
              onExploreRecommendations={() => setTab("recommended")}
            />
          </TabsContent>

          <TabsContent value="recommended" className="mt-8">
            <RecommendedTab onBookmark={handleBookmarkFromRecommendations} />
          </TabsContent>

          <TabsContent value="issues" className="mt-8">
            <WeeklyIssuesTab />
          </TabsContent>
        </Tabs>
      </main>
    </RequireAuth>
  );
}
