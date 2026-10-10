import QuizEditor from "@/components/admin/QuizEditor";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizEditor key={id} id={id} />;
}
