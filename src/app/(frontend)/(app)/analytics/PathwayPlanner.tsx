"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PathwaySummary = {
  id: string;
  name: string;
  baselineYear: number;
  targetYear: number;
  baselineEmissions: number;
  targetEmissions: number;
  targetReduction?: number | null;
};

export default function PathwayPlanner() {
  const [pathways, setPathways] = useState<PathwaySummary[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleCreatePathway = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const formData = new FormData(e.currentTarget);
      const response = await fetch("/api/app/analytics/pathways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baselineEmissions: parseFloat(formData.get("baseline") as string),
          targetEmissions: parseFloat(formData.get("target") as string),
          baselineYear: parseInt(formData.get("baselineYear") as string),
          targetYear: parseInt(formData.get("targetYear") as string),
          description: formData.get("description"),
          includeMilestones: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to create pathway");
      const newPathway: { pathway: PathwaySummary } = await response.json();
      setPathways([newPathway.pathway, ...pathways]);
      e.currentTarget.reset();
      setShowForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create pathway");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Decarbonization Pathways</CardTitle>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "Create Pathway"}
          </Button>
        </CardHeader>
        <CardContent>
          {showForm && (
            <form onSubmit={handleCreatePathway} className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="baseline">Baseline Emissions (tCO2e)</Label>
                  <Input
                    id="baseline"
                    name="baseline"
                    type="number"
                    placeholder="1000"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target">Target Emissions (tCO2e)</Label>
                  <Input
                    id="target"
                    name="target"
                    type="number"
                    placeholder="300"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baselineYear">Baseline Year</Label>
                  <Input
                    id="baselineYear"
                    name="baselineYear"
                    type="number"
                    defaultValue={new Date().getFullYear()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetYear">Target Year</Label>
                  <Input
                    id="targetYear"
                    name="targetYear"
                    type="number"
                    defaultValue={new Date().getFullYear() + 6}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <textarea
                  name="description"
                  className="w-full px-3 py-2 border rounded-md"
                  rows={3}
                  placeholder="Describe your pathway goals..."
                />
              </div>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Generate Pathway"}
              </Button>
            </form>
          )}

          {pathways.length === 0 && !showForm && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Create your first decarbonization pathway to get started.
              </AlertDescription>
            </Alert>
          )}

          {pathways.length > 0 && (
            <div className="space-y-3">
              {pathways.map((pathway) => (
                <div key={pathway.id} className="p-4 border rounded-lg hover:bg-muted">
                  <h3 className="font-semibold">{pathway.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {pathway.baselineYear} → {pathway.targetYear}
                  </p>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Baseline</span>
                      <p className="font-semibold">{pathway.baselineEmissions}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Target</span>
                      <p className="font-semibold">{pathway.targetEmissions}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Reduction</span>
                      <p className="font-semibold">
                        {pathway.targetReduction?.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
