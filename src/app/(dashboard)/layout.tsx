import { DashboardDataProvider } from "../../contexts/DashboardDataContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardDataProvider>{children}</DashboardDataProvider>;
}
