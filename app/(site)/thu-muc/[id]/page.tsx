import FolderView from "@/components/site/FolderView";

export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FolderView id={decodeURIComponent(id)} />;
}
