import {
  generateCertificateNumber,
  calculateExpirationDate,
  isExpiringSoon,
} from "@/lib/carbon-trust/certificateGenerator";

describe("certificateGenerator", () => {
  describe("generateCertificateNumber", () => {
    it("should generate a unique certificate number", () => {
      const orgId = "org-123";
      const date = new Date(2024, 0, 15); // January 15, 2024

      const cert1 = generateCertificateNumber(orgId, date);
      const cert2 = generateCertificateNumber(orgId, date);

      expect(cert1).toMatch(/^CT-202401-[A-F0-9]{4}$/);
      // Numbers should be different due to randomness
      expect(cert1).not.toEqual(cert2);
    });

    it("should include year and month in certificate number", () => {
      const orgId = "org-456";
      const date = new Date(2025, 6, 30); // July 30, 2025

      const cert = generateCertificateNumber(orgId, date);

      expect(cert).toContain("202507");
    });
  });

  describe("calculateExpirationDate", () => {
    it("should add 3 years to the issued date", () => {
      const issuedDate = new Date(2024, 0, 15); // January 15, 2024
      const expirationDate = calculateExpirationDate(issuedDate);

      expect(expirationDate.getFullYear()).toBe(2027);
      expect(expirationDate.getMonth()).toBe(0);
      expect(expirationDate.getDate()).toBe(15);
    });

    it("should handle leap years correctly", () => {
      const issuedDate = new Date(2024, 1, 29); // February 29, 2024 (leap year)
      const expirationDate = calculateExpirationDate(issuedDate);

      expect(expirationDate.getFullYear()).toBe(2027);
      expect(expirationDate.getMonth()).toBe(1);
    });
  });

  describe("isExpiringSoon", () => {
    it("should return true if certificate expires within 90 days", () => {
      const today = new Date();
      const expiresIn30Days = new Date(today);
      expiresIn30Days.setDate(expiresIn30Days.getDate() + 30);

      expect(isExpiringSoon(expiresIn30Days)).toBe(true);
    });

    it("should return true if certificate expires exactly in 90 days", () => {
      const today = new Date();
      const expiresIn90Days = new Date(today);
      expiresIn90Days.setDate(expiresIn90Days.getDate() + 90);

      expect(isExpiringSoon(expiresIn90Days)).toBe(true);
    });

    it("should return false if certificate expires after 90 days", () => {
      const today = new Date();
      const expiresIn91Days = new Date(today);
      expiresIn91Days.setDate(expiresIn91Days.getDate() + 91);

      expect(isExpiringSoon(expiresIn91Days)).toBe(false);
    });

    it("should return true if certificate is already expired", () => {
      const today = new Date();
      const expiredDate = new Date(today);
      expiredDate.setDate(expiredDate.getDate() - 1);

      expect(isExpiringSoon(expiredDate)).toBe(true);
    });
  });
});
