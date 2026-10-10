'use client';

interface WelcomeBannerProps {
  readonly userName: string;
}

export default function WelcomeBanner({ userName }: Readonly<WelcomeBannerProps>) {
  const currentDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="bg-gradient-to-r from-red-600 via-pink-600 to-rose-600 rounded-lg p-8 text-white shadow-lg mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-2">
            ¡Bienvenido de vuelta!
          </h2>
          <p className="text-red-50 text-lg mb-1">
            {userName}
          </p>
          <p className="text-red-100 text-sm capitalize">
            {currentDate}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <div className="text-right">
            <div className="text-6xl">📊</div>
          </div>
        </div>
      </div>
    </div>
  );
}
