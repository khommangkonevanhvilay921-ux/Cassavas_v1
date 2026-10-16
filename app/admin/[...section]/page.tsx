import { PortalWorkspace } from "@/app/components/portal-workspace";
import { requireDemoRole } from "@/app/lib/require-demo-role";
import { notFound } from "next/navigation";

export default async function AdminWorkspace({ params }: PageProps<"/admin/[...section]">) {
  const { section } = await params;
  await requireDemoRole("admin");
  if (section[0] === "transactions" || section[0] === "disputes") notFound();
  return <PortalWorkspace role="admin" section={section} />;
}