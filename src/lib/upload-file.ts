type PresignResponse = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
};

type PresignErrorResponse = {
  error?: string;
};

const MAX_SINGLE_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB

export async function uploadFileToR2(params: {
  file: File;
  folder: "releases" | "media" | "avatars";
  slug: string;
}) {
  console.log("uploadFileToR2 START", {
    fileName: params.file?.name,
    fileSize: params.file?.size,
    fileType: params.file?.type,
    folder: params.folder,
    slug: params.slug,
  });

  if (!params.file) {
    throw new Error("Keine Datei ausgewählt.");
  }

  if (!params.slug?.trim()) {
    throw new Error("Slug fehlt für den Upload.");
  }

  if (params.file.size > MAX_SINGLE_UPLOAD_SIZE) {
    throw new Error(
      "Die Datei ist zu groß für den aktuellen Direkt-Upload. Bitte vorerst maximal 500 MB hochladen."
    );
  }

  const fileType = params.file.type?.trim() || "application/octet-stream";

  console.log("calling /api/admin/uploads/presign");

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
      fileSize: params.file.size,
    }),
  });

  const presignData = (await presignResponse.json().catch(() => null)) as
    | PresignResponse
    | PresignErrorResponse
    | null;

  console.log("presignResponse status", presignResponse.status);
  console.log("presignData", presignData);

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

  console.log("starting PUT upload", presignData.uploadUrl);

  const uploadResponse = await fetch(presignData.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": fileType,
    },
    body: params.file,
  });

  console.log("uploadResponse status", uploadResponse.status);

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