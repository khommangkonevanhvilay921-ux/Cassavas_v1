import { notFound } from "next/navigation";
import { MiddlemanWorkspace } from "@/app/components/middleman-workspace";
import { requireDemoRole } from "@/app/lib/require-demo-role";

export default async function MiddlemanSection({ params, searchParams }: PageProps<"/middleman/[...section]">) {
  const { section } = await params;
  const query = await searchParams;
  await requireDemoRole("middleman");
  if (!["dashboard", "marketplace", "offers", "factories", "messages"].includes(section[0])) notFound();
  const recipient = query.recipient ?? query.farmer;
  return <MiddlemanWorkspace section={section} initialRecipient={Array.isArray(recipient) ? recipient[0] ?? "" : recipient ?? ""} initialListing={Array.isArray(query.listing) ? query.listing[0] ?? "" : query.listing ?? ""} />;
}
