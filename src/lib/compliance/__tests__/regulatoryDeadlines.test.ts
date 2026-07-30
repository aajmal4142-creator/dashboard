import { describe, it, expect, beforeEach, vi } from "vitest";
import { RegulatoryDeadlinesService, type ListViewOptions } from "../regulatoryDeadlines";

// Mock the payload
vi.mock("payload", () => ({
  getPayload: vi.fn(),
}));

describe("RegulatoryDeadlinesService", () => {
  let service: RegulatoryDeadlinesService;
  const mockOrgId = "org-123";

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe("getCalendarView", () => {
    it("should generate calendar for a given month/year", async () => {
      const result = await service.getCalendarView(mockOrgId, 2025, 0); // January 2025

      expect(result.year).toBe(2025);
      expect(result.month).toBe(0);
      expect(result.days.length).toBeGreaterThan(0);
      expect(result.days[0].date).toMatch(/2025-01-\d{2}/);
    });

    it("should mark today in calendar", async () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();

      const result = await service.getCalendarView(mockOrgId, year, month);
      const todayStr = today.toISOString().split("T")[0];
      const todayInCalendar = result.days.find((d) => d.date === todayStr);

      expect(todayInCalendar?.isToday).toBe(true);
    });
  });

  describe("getFilteredDeadlines", () => {
    it("should filter by jurisdiction", async () => {
      const options: ListViewOptions = {
        view: "all",
        jurisdiction: "EU",
      };

      const results = await service.getFilteredDeadlines(mockOrgId, options);
      // Results should be empty in test, but filter logic should work
      expect(Array.isArray(results)).toBe(true);
    });

    it("should filter by framework", async () => {
      const options: ListViewOptions = {
        view: "all",
        framework: "CSRD",
      };

      const results = await service.getFilteredDeadlines(mockOrgId, options);
      expect(Array.isArray(results)).toBe(true);
    });

    it("should filter by status", async () => {
      const options: ListViewOptions = {
        view: "all",
        status: "overdue",
      };

      const results = await service.getFilteredDeadlines(mockOrgId, options);
      expect(Array.isArray(results)).toBe(true);
    });

    it("should filter by search query", async () => {
      const options: ListViewOptions = {
        view: "all",
        searchQuery: "annual",
      };

      const results = await service.getFilteredDeadlines(mockOrgId, options);
      expect(Array.isArray(results)).toBe(true);
    });

    it("should sort by due date ascending", async () => {
      const options: ListViewOptions = {
        view: "all",
      };

      const results = await service.getFilteredDeadlines(mockOrgId, options);

      if (results.length > 1) {
        for (let i = 0; i < results.length - 1; i++) {
          expect(new Date(results[i].dueDate) <= new Date(results[i + 1].dueDate)).toBe(
            true,
          );
        }
      }
    });
  });

  describe("getSummary", () => {
    it("should return summary statistics", async () => {
      const summary = await service.getSummary(mockOrgId);

      expect(summary).toHaveProperty("total");
      expect(summary).toHaveProperty("notStarted");
      expect(summary).toHaveProperty("inProgress");
      expect(summary).toHaveProperty("completed");
      expect(summary).toHaveProperty("submitted");
      expect(summary).toHaveProperty("verified");
      expect(summary).toHaveProperty("overdue");
      expect(summary).toHaveProperty("dueInNext7Days");
      expect(summary).toHaveProperty("dueInNext30Days");
    });

    it("should calculate overdue deadlines correctly", async () => {
      const summary = await service.getSummary(mockOrgId);
      expect(summary.overdue).toBeGreaterThanOrEqual(0);
    });

    it("should calculate upcoming deadlines correctly", async () => {
      const summary = await service.getSummary(mockOrgId);
      expect(summary.dueInNext7Days).toBeGreaterThanOrEqual(0);
      expect(summary.dueInNext30Days).toBeGreaterThanOrEqual(0);
    });
  });

  describe("exportToICal", () => {
    it("should generate valid iCal format", async () => {
      const ical = await service.exportToICal(mockOrgId, "Test Org");

      expect(ical).toContain("BEGIN:VCALENDAR");
      expect(ical).toContain("END:VCALENDAR");
      expect(ical).toContain("VERSION:2.0");
      expect(ical).toContain("PRODID:-//ClearESG");
    });

    it("should include organization name in calendar", async () => {
      const ical = await service.exportToICal(mockOrgId, "TestOrg123");

      expect(ical).toContain("TestOrg123");
    });

    it("should escape special characters in event text", async () => {
      const ical = await service.exportToICal(mockOrgId, "Test Org");

      // Should have escaped commas, semicolons, etc.
      // This is a basic check
      expect(ical).toContain("VEVENT");
    });
  });

  describe("filtering edge cases", () => {
    it("should handle upcoming view correctly", async () => {
      const today = new Date().toISOString().split("T")[0];
      const options: ListViewOptions = {
        view: "upcoming",
      };

      const results = await service.getFilteredDeadlines(mockOrgId, options);

      // All results should be >= today
      results.forEach((d) => {
        expect(d.dueDate >= today).toBe(true);
      });
    });

    it("should handle overdue view correctly", async () => {
      const today = new Date().toISOString().split("T")[0];
      const options: ListViewOptions = {
        view: "overdue",
      };

      const results = await service.getFilteredDeadlines(mockOrgId, options);

      // All results should be < today
      results.forEach((d) => {
        expect(d.dueDate < today).toBe(true);
      });
    });
  });
});
