export type TourStep = {
  id: string;
  title: string;
  body: string;
  /** Matches `[data-tour="…"]` on the page. Missing target → centered card. */
  target?: string;
};

export type TourDefinition = {
  id: string;
  title: string;
  description: string;
  /** Pathname prefix where this tour’s targets exist. */
  routePrefix: string;
  steps: readonly TourStep[];
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  tags: readonly string[];
};

export type ContextTip = {
  title: string;
  tips: readonly string[];
  relatedTourId?: string;
};

export type HelpTab = "shortcuts" | "tours" | "faq";
