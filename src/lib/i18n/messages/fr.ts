/**
 * French UI catalog — overlays English via deepMerge in messages/index.
 */

import type { MessageTree } from "@/lib/i18n/messages";

export const fr: MessageTree = {
  common: {
    save: "Enregistrer",
    cancel: "Annuler",
    organisation: "Organisation",
  },
  nav: {
    groups: {
      work: "Travail",
      collaborate: "Collaborer",
      assure: "Assurer",
      account: "Compte",
    },
    items: {
      metrics: "Indicateurs",
      suppliers: "Fournisseurs",
      reports: "Rapports",
      assurance: "Assurance",
      billing: "Facturation",
      settings: "Paramètres",
      engagements: "Missions",
      csrd: "CSRD / ESRS",
      sfdr: "SFDR PAI",
    },
  },
  settings: {
    eyebrow: "Compte",
    title: "Paramètres",
    help: "Marque de l’organisation, portail fournisseurs, méthodologie d’émissions et clés API BI.",
    language: {
      title: "Langue",
      help: "Langue de l’interface ClearESG. La préférence est enregistrée sur votre compte.",
      label: "Langue",
      english: "English",
      hindi: "Hindi",
      french: "Français",
      saved: "Langue enregistrée.",
      saving: "Enregistrement…",
      error: "Impossible d’enregistrer la langue. Réessayez.",
    },
  },
  reports: {
    audiencePackDownload: "Pack audience",
    audiencePackLoading: "Préparation du pack…",
    audiencePackError: "Échec du téléchargement du pack audience. Réessayez.",
    audiencePackOk: "Téléchargement démarré.",
  },
};
