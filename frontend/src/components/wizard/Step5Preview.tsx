interface Step5PreviewProps {
  onNext: () => void;
  onBack: () => void;
}

export function Step5Preview({ onNext, onBack }: Step5PreviewProps) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-tv-2xl font-semibold text-madhive-pink mb-4">
          Preview Your Dashboard
        </h2>
        <p className="text-tv-lg text-madhive-chalk/80">
          See how your dashboard will look on a TV display
        </p>
      </div>

      <div className="bg-madhive-purple-dark border-2 border-madhive-purple-medium rounded-lg p-12 min-h-[400px] flex items-center justify-center">
        <div className="text-center text-madhive-chalk/60">
          <div className="text-tv-2xl mb-4">📺</div>
          <div className="text-tv-lg">Dashboard preview will render here</div>
          <div className="text-tv-sm mt-2">(Enhanced in later tasks with actual widgets)</div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-8 py-4 bg-madhive-purple-dark border-2 border-madhive-purple-medium text-madhive-chalk rounded-lg text-tv-lg font-semibold hover:bg-madhive-purple-medium transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-8 py-4 bg-madhive-pink text-madhive-purple-deepest rounded-lg text-tv-lg font-semibold hover:bg-madhive-pink/80 transition-all"
        >
          Deploy Dashboard →
        </button>
      </div>
    </div>
  );
}
