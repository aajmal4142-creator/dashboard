import { getPayload } from "payload";
import config from "@/payload.config";

export type VolumeTier = {
  minSeats: number;
  discountPercent: number;
};

export async function getApplicableDiscount(
  planId: string,
  seatCount: number,
): Promise<number> {
  const payload = await getPayload({ config });

  const plan = await payload.findByID({
    collection: "plans",
    id: planId,
  });

  const tiers = (plan.volumeDiscounts ?? []).map((tier) => ({
    minSeats: tier.minSeats,
    discountPercent: tier.discountPercent,
  }));

  // Find the highest tier that matches the seat count
  let applicableDiscount = 0;
  for (const tier of tiers) {
    if (seatCount >= tier.minSeats) {
      applicableDiscount = Math.max(applicableDiscount, tier.discountPercent);
    }
  }

  return applicableDiscount;
}

export async function calculateDiscountedPrice(
  planId: string,
  basePrice: number,
  seatCount: number,
): Promise<{
  basePrice: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
}> {
  const discountPercent = await getApplicableDiscount(planId, seatCount);
  const discountAmount = (basePrice * discountPercent) / 100;
  const finalPrice = Math.round((basePrice - discountAmount) * 100) / 100;

  return {
    basePrice,
    discountPercent,
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalPrice,
  };
}

export async function applyVolumeDiscountToSubscription(
  subscriptionId: string,
  seatCount: number,
): Promise<void> {
  const payload = await getPayload({ config });

  const subscription = await payload.findByID({
    collection: "subscriptions",
    id: subscriptionId,
  });

  const planId =
    typeof subscription.plan === "object" ? subscription.plan.id : subscription.plan;
  const discountPercent = await getApplicableDiscount(String(planId), seatCount);

  // Persist on the existing annualDiscountPercentage field (volume discount applied)
  await payload.update({
    collection: "subscriptions",
    id: subscriptionId,
    data: {
      seats: seatCount,
      annualDiscountPercentage: discountPercent,
    },
  });
}

export function formatDiscountTierDisplay(tier: VolumeTier): string {
  if (tier.minSeats === 20)
    return `${tier.minSeats}+ seats: ${tier.discountPercent}% off`;
  if (tier.minSeats === 5)
    return `${tier.minSeats}-19 seats: ${tier.discountPercent}% off`;
  return `${tier.minSeats}+ seats: ${tier.discountPercent}% off`;
}
