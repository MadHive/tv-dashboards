function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-madhive-purple-deepest via-madhive-purple-deep to-madhive-purple-dark">
      <div className="container mx-auto px-8 py-16">
        <h1 className="text-tv-huge font-display font-bold text-madhive-pink mb-4">
          MadHive
        </h1>
        <p className="text-tv-xl text-madhive-chalk">
          TV Dashboards - React Edition
        </p>
        <div className="mt-8 p-6 bg-madhive-purple-dark/50 backdrop-blur-sm rounded-lg border border-madhive-purple-medium">
          <p className="text-tv-base text-madhive-chalk/80">
            System initializing...
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
