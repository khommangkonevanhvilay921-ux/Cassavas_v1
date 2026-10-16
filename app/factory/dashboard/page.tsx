import { PortalWorkspace } from "@/app/components/portal-workspace";
import { requireDemoRole } from "@/app/lib/require-demo-role";

export default async function FactoryDashboard() {
  await requireDemoRole("factory");
  return <PortalWorkspace role="factory" section={["dashboard"]} />;
}
