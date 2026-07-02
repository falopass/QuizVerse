export default function QuizResultLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-4 py-12 sm:px-6 lg:px-8">
      <div className="bg-bg-tertiary mx-auto h-48 w-48 rounded-full" />
      <div className="bg-bg-tertiary mx-auto mt-6 h-8 w-64 rounded-lg" />
      <div className="bg-bg-tertiary mx-auto mt-3 h-5 w-80 rounded-lg" />
      <div className="bg-bg-tertiary mx-auto mt-2 h-5 w-48 rounded-lg" />
      <div className="mt-8 flex justify-center gap-4">
        <div className="bg-bg-tertiary h-12 w-40 rounded-lg" />
        <div className="bg-bg-tertiary h-12 w-40 rounded-lg" />
      </div>
    </div>
  );
}
