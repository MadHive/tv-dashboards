import { LayoutType, AnimationIntensity, ColorScheme } from '@/lib/wizardState';

interface Step4VisualStyleProps {
  layoutType: LayoutType | null;
  animationIntensity: AnimationIntensity;
  colorScheme: ColorScheme;
  onUpdateLayout: (layout: LayoutType) => void;
  onUpdateAnimation: (intensity: AnimationIntensity) => void;
  onUpdateColorScheme: (scheme: ColorScheme) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step4VisualStyle({
  layoutType,
  animationIntensity,
  colorScheme,
  onUpdateLayout,
  onUpdateAnimation,
  onUpdateColorScheme,
  onNext,
  onBack
}: Step4VisualStyleProps) {
  const layouts: Array<{ value: LayoutType; name: string; preview: string }> = [
    {
      value: 'grid',
      name: 'Grid Layout',
      preview: `┌────┐ ┌────┐ ┌────┐
│ 1  │ │ 2  │ │ 3  │
└────┘ └────┘ └────┘
┌──────────┐ ┌──────────┐
│    4     │ │    5     │
└──────────┘ └──────────┘`
    },
    {
      value: 'hero-grid',
      name: 'Hero + Grid',
      preview: `┌─────────────────────────┐
│     Hero Metric         │
└─────────────────────────┘
┌────┐ ┌────┐ ┌────┐
│ 1  │ │ 2  │ │ 3  │
└────┘ └────┘ └────┘`
    },
    {
      value: 'sidebar-main',
      name: 'Sidebar + Main',
      preview: `┌──┐ ┌─────────────────┐
│1 │ │                 │
├──┤ │   Main Chart    │
│2 │ │                 │
├──┤ └─────────────────┘
│3 │ ┌────┐ ┌────┐
└──┘ │ 4  │ │ 5  │`
    }
  ];

  const animations: Array<{ value: AnimationIntensity; icon: string; name: string; description: string }> = [
    {
      value: 'subtle',
      icon: '🌙',
      name: 'Subtle',
      description: 'Minimal motion, fade transitions'
    },
    {
      value: 'moderate',
      icon: '⭐',
      name: 'Moderate',
      description: 'Smooth animations, data transitions (recommended)'
    },
    {
      value: 'bold',
      icon: '✨',
      name: 'Bold',
      description: 'Eye-catching effects, glows, pulses'
    }
  ];

  const colorSchemes: Array<{ value: ColorScheme; icon: string; name: string; colors: string[] }> = [
    {
      value: 'madhive',
      icon: '🎨',
      name: 'MadHive Brand',
      colors: ['#FDA4D4', '#4a2c6d', '#1a0b2e']
    },
    {
      value: 'dark-minimal',
      icon: '🌃',
      name: 'Dark Minimal',
      colors: ['#000000', '#333333', '#ffffff']
    },
    {
      value: 'vibrant',
      icon: '🌈',
      name: 'Vibrant',
      colors: ['#ff4757', '#00d9ff', '#00ff9f', '#ffb800']
    }
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-tv-2xl font-semibold text-madhive-pink mb-4">
          Choose Visual Style
        </h2>
        <p className="text-tv-lg text-madhive-chalk/80">
          Customize how your dashboard looks on TV displays
        </p>
      </div>

      {/* Layout Selection */}
      <div>
        <h3 className="text-tv-xl font-semibold text-madhive-chalk mb-4">Layout</h3>
        <div className="grid grid-cols-3 gap-4">
          {layouts.map((layout) => (
            <button
              key={layout.value}
              onClick={() => onUpdateLayout(layout.value)}
              className={`
                p-6 rounded-lg border-2 transition-all
                ${
                  layoutType === layout.value
                    ? 'bg-madhive-pink border-madhive-pink text-madhive-purple-deepest'
                    : 'bg-madhive-purple-dark border-madhive-purple-medium text-madhive-chalk hover:border-madhive-pink'
                }
              `}
            >
              <div className="text-tv-base font-semibold mb-4">{layout.name}</div>
              <pre className={`text-tv-xs font-mono ${layoutType === layout.value ? 'text-madhive-purple-deepest/70' : 'text-madhive-chalk/60'}`}>
                {layout.preview}
              </pre>
            </button>
          ))}
        </div>
      </div>

      {/* Animation Intensity */}
      <div>
        <h3 className="text-tv-xl font-semibold text-madhive-chalk mb-4">Animation Intensity</h3>
        <div className="grid grid-cols-3 gap-4">
          {animations.map((anim) => (
            <button
              key={anim.value}
              onClick={() => onUpdateAnimation(anim.value)}
              className={`
                p-6 rounded-lg border-2 text-left transition-all
                ${
                  animationIntensity === anim.value
                    ? 'bg-madhive-pink border-madhive-pink text-madhive-purple-deepest'
                    : 'bg-madhive-purple-dark border-madhive-purple-medium text-madhive-chalk hover:border-madhive-pink'
                }
              `}
            >
              <div className="text-4xl mb-3">{anim.icon}</div>
              <div className={`text-tv-lg font-semibold mb-2 ${animationIntensity === anim.value ? 'text-madhive-purple-deepest' : 'text-madhive-pink'}`}>
                {anim.name}
              </div>
              <div className={`text-tv-sm ${animationIntensity === anim.value ? 'text-madhive-purple-deepest/70' : 'text-madhive-chalk/60'}`}>
                {anim.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Color Scheme */}
      <div>
        <h3 className="text-tv-xl font-semibold text-madhive-chalk mb-4">Color Scheme</h3>
        <div className="grid grid-cols-3 gap-4">
          {colorSchemes.map((scheme) => (
            <button
              key={scheme.value}
              onClick={() => onUpdateColorScheme(scheme.value)}
              className={`
                p-6 rounded-lg border-2 text-left transition-all
                ${
                  colorScheme === scheme.value
                    ? 'bg-madhive-pink border-madhive-pink text-madhive-purple-deepest'
                    : 'bg-madhive-purple-dark border-madhive-purple-medium text-madhive-chalk hover:border-madhive-pink'
                }
              `}
            >
              <div className="text-4xl mb-3">{scheme.icon}</div>
              <div className={`text-tv-lg font-semibold mb-3 ${colorScheme === scheme.value ? 'text-madhive-purple-deepest' : 'text-madhive-pink'}`}>
                {scheme.name}
              </div>
              <div className="flex gap-2">
                {scheme.colors.map((color, idx) => (
                  <div
                    key={idx}
                    className="w-8 h-8 rounded border-2 border-white/20"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </button>
          ))}
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
          disabled={!layoutType}
          className={`
            px-8 py-4 rounded-lg text-tv-lg font-semibold transition-all
            ${
              layoutType
                ? 'bg-madhive-pink text-madhive-purple-deepest hover:bg-madhive-pink/80'
                : 'bg-madhive-purple-medium text-madhive-chalk/50 cursor-not-allowed'
            }
          `}
        >
          Preview Dashboard →
        </button>
      </div>
    </div>
  );
}
