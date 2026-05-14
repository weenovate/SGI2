import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AcceptOffer } from "./accept";

export default async function Page({ params }: { params: Promise<{ offerId: string }> }) {
  const session = await auth();
  const { offerId } = await params;
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/lista-espera/${offerId}/aceptar`)}`);
  }
  return <AcceptOffer offerId={offerId} />;
}
