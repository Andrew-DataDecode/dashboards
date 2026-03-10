export async function downloadCsv(
  slug: string,
  sourceId: string,
  filters: Record<string, unknown>,
  getToken: () => Promise<string | null>,
): Promise<void> {
  const token = await getToken();
  const res = await fetch(`/api/dashboard/${slug}/export/${sourceId}/csv`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ filters }),
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `${slug}_${sourceId}_${today}.csv`);
}

export async function downloadXlsx(
  slug: string,
  sourceId: string,
  filters: Record<string, unknown>,
  getToken: () => Promise<string | null>,
): Promise<void> {
  const token = await getToken();
  const res = await fetch(`/api/dashboard/${slug}/export/${sourceId}/xlsx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ filters }),
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `${slug}_${sourceId}_${today}.xlsx`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
