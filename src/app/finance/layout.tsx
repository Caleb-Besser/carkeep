import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finance Tracker",
  icons: {
    icon: "/finance_logo.png",
    shortcut: "/finance_logo.png",
  },
};

export default function FinanceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="finance-shell">{children}</div>;
}
