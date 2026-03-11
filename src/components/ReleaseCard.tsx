export default function ReleaseCard({ release }: { release: any }) {
  return (
    <div style={{ border: "1px solid #333", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>
            <a href={`/releases/${release.id}`}>{release.title}</a>
          </h3>
          <div style={{ opacity: 0.8 }}>v{release.version}</div>
          {release.description && <p style={{ marginTop: 8 }}>{release.description}</p>}
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            by {release.author?.name ?? release.author?.email} • comments: {release._count?.comments ?? 0}
          </div>
        </div>
        <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
          <a href={release.fileUrl} target="_blank" rel="noreferrer">
            Download
          </a>
          <a href={`/releases/${release.id}/edit`}>Edit</a>
        </div>
      </div>
    </div>
  );
}