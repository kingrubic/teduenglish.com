import QuizView from "@/components/site/QuizView";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizView id={decodeURIComponent(id)} />;
}
