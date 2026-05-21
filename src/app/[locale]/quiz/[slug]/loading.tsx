export default function QuizDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 animate-pulse">
      <div className="bg-bg-tertiary h-8 w-48 rounded-lg" />
      <div className="bg-bg-tertiary mt-4 h-6 w-96 rounded-lg" />
      <div className="bg-bg-tertiary mt-2 h-6 w-72 rounded-lg" />
      <div className="bg-bg-tertiary mt-8 h-64 w-full rounded-xl" />
      <div className="mt-8 flex gap-4">
        <div className="bg-bg-tertiary h-12 w-36 rounded-lg" />
        <div className="bg-bg-tertiary h-12 w-36 rounded-lg" />
      </div>
    </div>
  );
}
