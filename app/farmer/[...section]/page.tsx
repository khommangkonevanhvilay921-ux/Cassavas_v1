import { PortalWorkspace } from "@/app/components/portal-workspace";
import { requireDemoRole } from "@/app/lib/require-demo-role";
import { notFound } from "next/navigation";

export default async function FarmerSection({ params }: PageProps<"/farmer/[...section]">) {
  const { section } = await params;
  await requireDemoRole("farmer");
  if (section[0] === "transactions") notFound();
  return <PortalWorkspace role="farmer" section={section} />;
}