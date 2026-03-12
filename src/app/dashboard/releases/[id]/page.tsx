import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminReleasePage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/dashboard/releases/${id}/edit`);
}