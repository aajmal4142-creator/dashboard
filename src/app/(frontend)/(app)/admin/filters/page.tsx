"use client";

import { useState, useEffect } from "react";
import { PageFrame } from "@/components/shell/PageFrame";
import { SavedFiltersPanel } from "@/components/filters/SavedFiltersPanel";
import { useSavedFilters } from "@/lib/hooks/useSavedFilters";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const RESOURCE_TYPES = [
  "suppliers",
  "datapoints",
  "reports",
  "users",
  "materiality",
  "obligations",
  "audit-logs",
];

export default function SavedFiltersPage() {
  const { loading, loadFilters } = useSavedFilters();
  const [activeTab, setActiveTab] = useState("suppliers");

  useEffect(() => {
    loadFilters(activeTab);
  }, [activeTab, loadFilters]);

  return (
    <PageFrame
      eyebrow="Admin"
      title="Saved Views"
      help="Manage saved filters and custom views for each resource type"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {RESOURCE_TYPES.map((type) => (
            <TabsTrigger key={type} value={type} className="capitalize">
              {type}
            </TabsTrigger>
          ))}
        </TabsList>

        {RESOURCE_TYPES.map((type) => (
          <TabsContent key={type} value={type}>
            {loading ? (
              <p className="text-gray-500">Loading filters...</p>
            ) : (
              <SavedFiltersPanel
                resourceType={type}
                onFilterSelect={(filter) => {
                  console.log("Selected filter:", filter);
                }}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </PageFrame>
  );
}
