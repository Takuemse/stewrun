import { redirect } from "next/navigation";

export default function OrdersRedirect() {
  redirect("/my-requests?tab=past");
}
