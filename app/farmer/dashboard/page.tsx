import { PortalWorkspace } from "@/app/components/portal-workspace";
import { requireDemoRole } from "@/app/lib/require-demo-role";

export default async function FarmerDashboard() {
  await requireDemoRole("farmer");
  return <PortalWorkspace role="farmer" section={["dashboard"]} />;
}