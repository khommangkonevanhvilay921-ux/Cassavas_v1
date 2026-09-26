import { PortalWorkspace } from "@/app/components/portal-workspace";

export default async function FactorySection({ params }: PageProps<"/factory/[...section]">) {
  const { section } = await params;
  return <PortalWorkspace role="factory" section={section} />;
}