import { MiddlemanWorkspace } from "@/app/components/middleman-workspace";
import { requireDemoRole } from "@/app/lib/require-demo-role";

export default async function MiddlemanDashboard() {
  await requireDemoRole("middleman");
  return <MiddlemanWorkspace section={["dashboard"]} />;
}
