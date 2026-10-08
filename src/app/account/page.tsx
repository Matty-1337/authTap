import { redirect } from "next/navigation";
import { strayUrl } from "@/lib/sso-account-continue";

/** AuthTAP has no account page: it is only the sign-in step between a product and its client. */
export default function AccountPage() {
  redirect(strayUrl());
}
