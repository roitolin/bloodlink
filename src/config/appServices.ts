export type AppService = "bloodlink" | "funeral";

export const appServices: Record<
  AppService,
  {
    key: AppService;
    label: string;
    shortLabel: string;
    description: string;
    accent: string;
    softAccent: string;
    border: string;
    icon: string;
  }
> = {
  bloodlink: {
    key: "bloodlink",
    label: "LifeCycle",
    shortLabel: "Blood and Request",
    description: "Blood donation support for finding donors, managing requests, and responding to urgent needs.",
    accent: "#d32f2f",
    softAccent: "#fff1f2",
    border: "#fecaca",
    icon: "water",
  },
  funeral: {
    key: "funeral",
    label: "LifeCycle",
    shortLabel: "Funeral Shop",
    description: "Funeral service support for viewing providers, planning arrangements, and staying updated.",
    accent: "#334155",
    softAccent: "#f8fafc",
    border: "#cbd5e1",
    icon: "flower",
  },
};
