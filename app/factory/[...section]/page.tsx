import { PortalWorkspace } from "@/app/components/portal-workspace";
import { requireDemoRole } from "@/app/lib/require-demo-role";
import { notFound } from "next/navigation";

export default async function FactorySection({ params }: PageProps<"/factory/[...section]">) {
  const { section } = await params;
  await requireDemoRole("factory");
  if (section[0] === "transactions" || section[0] === "procurement") notFound();
  return <PortalWorkspace role="factory" section={section} />;
}