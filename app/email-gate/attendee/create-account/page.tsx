import { redirect } from "next/navigation";
import { CREATE_ACCOUNT_PATH } from "@/lib/auth/routing";

/** Legacy path — canonical create-account route is `/create-account`. */
export default function LegacyCreateAccountPage() {
  redirect(CREATE_ACCOUNT_PATH);
}
