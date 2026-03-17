import { redirect } from "next/navigation";

type PageProps = {
  params: {
    id: string;
  };
};

export default function AdminReleasePage({ params }: PageProps) {
  const { id } = params;

  redirect(`/dashboard/releases/${id}/edit`);
}