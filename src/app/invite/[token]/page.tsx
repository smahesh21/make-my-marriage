import type { Metadata } from "next";
import { PublicInvitationPage } from "./PublicInvitationPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your private wedding invitation — Make My Marriage",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <PublicInvitationPage token={(await params).token} />;
}
