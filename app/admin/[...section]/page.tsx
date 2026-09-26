import { PortalWorkspace } from "@/app/components/portal-workspace";

export default async function AdminWorkspace({ params }: PageProps<"/admin/[...section]">) {
  const { section } = await params;
  return <PortalWorkspace role="admin" section={section} />;
}