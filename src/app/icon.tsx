import { ImageResponse } from 'next/og'

// Configuración del ícono
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// Componente que genera el ícono
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
          borderRadius: '6px',
        }}
      >
        {/* Ícono de píldora simplificado */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M10.5 20.5C14.366 20.5 17.5 17.366 17.5 13.5C17.5 9.63401 14.366 6.5 10.5 6.5C6.63401 6.5 3.5 9.63401 3.5 13.5C3.5 17.366 6.63401 20.5 10.5 20.5Z"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.328 7.172L7.172 13.328"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10.5 3.5L13.5 6.5"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6.5 17.5L3.5 20.5"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
