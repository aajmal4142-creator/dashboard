"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ScenarioSummary = {
  id: string;
  name: string;
  baselineYear: number;
  targetYear: number;
  status?: string | null;
};

export default function ScenarioBuilder() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        const response = await fetch("/api/app/analytics/scenarios");
        if (!response.ok) throw new Error("Failed to fetch scenarios");
        const data: { scenarios?: ScenarioSummary[] } = await response.json();
        setScenarios(data.scenarios || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load scenarios");
      } finally {
        setLoading(false);
      }
    };

    fetchScenarios();
  }, []);

  const handleCreateScenario = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const formData = new FormData(e.currentTarget);
      const response = await fetch("/api/app/analytics/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          type: formData.get("type") || "custom",
          baselineYear: parseInt(formData.get("baselineYear") as string),
          targetYear: parseInt(formData.get("targetYear") as string),
          variables: [
            {
              leverId: "renewable_energy",
              leverName: "Renewable Energy",
              currentValue: 20,
              targetValue: 80,
              capexRequired: 500000,
              implementationTimeline: 3,
            },
          ],
        }),
      });

      if (!response.ok) throw new Error("Failed to create scenario");
      const newScenario: ScenarioSummary = await response.json();
      setScenarios([newScenario, ...scenarios]);
      e.currentTarget.reset();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create scenario");
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Scenario</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateScenario} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Scenario Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Net Zero by 2030"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Scenario Type</Label>
                <select name="type" className="w-full px-3 py-2 border rounded-md">
                  <option value="baseline">Baseline</option>
                  <option value="optimistic">Optimistic</option>
                  <option value="pessimistic">Pessimistic</option>
                  <option value="custom">Custom</option>
                </select>
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
                  defaultValue={new Date().getFullYear() + 5}
                />
              </div>
            </div>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Scenario"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {scenarios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Scenarios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className="p-4 border rounded-lg hover:bg-muted cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{scenario.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {scenario.baselineYear} → {scenario.targetYear}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      {scenario.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
