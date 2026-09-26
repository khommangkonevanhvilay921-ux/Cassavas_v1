import { PortalWorkspace } from "@/app/components/portal-workspace";

export default async function FarmerSection({ params }: PageProps<"/farmer/[...section]">) {
  const { section } = await params;
  return <PortalWorkspace role="farmer" section={section} />;
}