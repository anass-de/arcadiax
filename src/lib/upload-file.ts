type PresignResponse = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
};

type PresignErrorResponse = {
  error?: string;
};

export async function uploadFileToR2(params: {
  file: File;
  folder: "releases" | "media" | "avatars";
  slug: string;
}) {
  const fileType = params.file.type?.trim() || "application/octet-stream";

  const presignResponse = await fetch("/api/admin/uploads/presign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: params.file.name,
      fileType,
      folder: params.folder,
      slug: params.slug,
    }),
  });

  const presignData = (await presignResponse.json().catch(() => null)) as
    | PresignResponse
    | PresignErrorResponse
    | null;

  if (
    !presignResponse.ok ||
    !presignData ||
    !("uploadUrl" in presignData) ||
    !presignData.uploadUrl ||
    !presignData.publicUrl
  ) {
    const errorMessage =
      presignData && "error" in presignData && presignData.error
        ? presignData.error
        : "Presigned URL konnte nicht erstellt werden.";

    throw new Error(errorMessage);
  }

  const uploadResponse = await fetch(presignData.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": fileType,
    },
    body: params.file,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => "");
    throw new Error(
      `Upload fehlgeschlagen (${uploadResponse.status}). ${errorText}`
    );
  }

  return {
    url: presignData.publicUrl,
    key: presignData.key,
  };
}