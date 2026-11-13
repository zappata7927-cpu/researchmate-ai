"use client";

import { useEffect, useState } from "react";
import { AppShell, useHashRoute } from "@/components/app/shell";
import { HomeView } from "@/components/app/home";
import { NewReviewView, type NewMode } from "@/components/app/new-review";
import { ProjectView } from "@/components/app/project-view";
import { HistoryView, SettingsView, AboutView } from "@/components/app/misc-views";
import { api } from "@/lib/client";

function useProjects() {
  const [projects, setProjects] = useState<any[]>([]);
  useEffect(() => {
    api("/api/projects")
      .then((r) => setProjects(r.projects))
      .catch(() => setProjects([]));
  }, []);
  return projects;
}

function useHealth() {
  const [aiConfigured, setAiConfigured] = useState(true);
  useEffect(() => {
    api("/api/health")
      .then((r) => setAiConfigured(!!r.ai?.configured))
      .catch(() => setAiConfigured(false));
  }, []);
  return aiConfigured;
}

const NEW_MODES: NewMode[] = ["proposal", "manuscript", "stats", "references", "journal", "reviewers", "revision"];

function Router() {
  const hash = useHashRoute();
  const projects = useProjects();
  const aiConfigured = useHealth();

  if (hash.startsWith("#/new/")) {
    const mode = hash.replace("#/new/", "").split("/")[0] as NewMode;
    if (NEW_MODES.includes(mode)) {
      return <NewReviewView key={mode} mode={mode} />;
    }
  }
  if (hash.startsWith("#/project/")) {
    const id = hash.replace("#/project/", "").split("?")[0];
    if (id) return <ProjectView key={id} id={id} />;
  }
  if (hash.startsWith("#/history")) return <HistoryView />;
  if (hash.startsWith("#/settings")) return <SettingsView />;
  if (hash.startsWith("#/about")) return <AboutView />;
  return <HomeView projects={projects} aiConfigured={aiConfigured} />;
}

export default function Page() {
  const hash = useHashRoute();
  const aiConfigured = useHealth();
  return (
    <AppShell active={hash} aiConfigured={aiConfigured}>
      <Router />
    </AppShell>
  );
}
