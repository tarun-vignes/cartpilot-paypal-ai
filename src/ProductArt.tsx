import type { Product } from './shared';

// Original inline SVG illustrations. These are conceptual demo products, not retailer photos.
export function ProductArt({ product }: { product: Product }) {
  return (
    <svg
      className={`product-art ${product.art}`}
      viewBox="0 0 400 280"
      role="img"
      aria-label={`Illustration of ${product.name}`}
      style={{ background: product.color }}
    >
      <ellipse
        cx="205"
        cy="230"
        rx="125"
        ry="14"
        fill="#192a1f"
        opacity=".09"
      />
      <g
        stroke="#354038"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="#f8f8ec"
      >
        {product.art === 'keyboard' && (
          <g transform="translate(55 88) rotate(-8 145 60)">
            <rect width="290" height="130" rx="15" fill="#ecedde" />
            <path d="M0 112v10q0 13 15 13h260q15 0 15-13v-10" fill="#a3aa8b" />
            {Array.from({ length: 48 }, (_, i) => (
              <rect
                key={i}
                x={14 + (i % 12) * 22}
                y={14 + Math.floor(i / 12) * 22}
                width="17"
                height="16"
                rx="3"
                fill={i === 0 ? '#a2b17a' : '#f9faed'}
                strokeWidth="1"
              />
            ))}
            <rect
              x="79"
              y="104"
              width="132"
              height="12"
              rx="3"
              strokeWidth="1"
            />
          </g>
        )}
        {product.art === 'charger' && (
          <g transform="translate(136 58) rotate(12 65 85)">
            <path d="M33 0v-22h12V0m43 0v-22h12V0" fill="#aab0a6" />
            <rect width="133" height="160" rx="25" fill="#eeeada" />
            <path d="M5 133q58 25 123 0" fill="none" />
            <rect x="35" y="71" width="63" height="19" rx="9" fill="#4a5045" />
            <rect x="35" y="104" width="63" height="19" rx="9" fill="#4a5045" />
            <text
              x="67"
              y="41"
              textAnchor="middle"
              fontSize="13"
              stroke="none"
              fill="#6c705e"
            >
              45 W
            </text>
          </g>
        )}
        {product.art === 'bag' && (
          <g transform="translate(114 33)">
            <path d="M55 33V19q30-35 60 0v14" fill="none" strokeWidth="10" />
            <rect
              x="0"
              y="28"
              width="174"
              height="184"
              rx="42"
              fill="#a6ab96"
            />
            <path d="M17 85q60-34 140 0" fill="none" />
            <rect
              x="23"
              y="111"
              width="128"
              height="80"
              rx="18"
              fill="#c3c5ad"
            />
            <path d="M37 132h100" />
            <path d="M130 131v13" />
            <rect x="63" y="59" width="47" height="19" rx="3" fill="#ebebd8" />
          </g>
        )}
        {product.art === 'bottle' && (
          <g transform="translate(151 30) rotate(8 45 100)">
            <rect x="20" y="0" width="54" height="29" rx="7" fill="#6b8476" />
            <path
              d="M21 27q-22 23-22 39v120q0 24 24 24h45q24 0 24-24V66q0-16-22-39z"
              fill="#91ac9c"
            />
            <path d="M12 75v111" stroke="#c5d5c8" strokeWidth="7" />
            <path d="M4 180h82" fill="none" />
          </g>
        )}
        {product.art === 'stand' && (
          <g transform="translate(66 55)">
            <path d="M17 134l199-96 40 27-203 99z" fill="#c7cdd0" />
            <path d="M53 164v26l201-95V65" fill="#e9ebdf" />
            <path d="M80 153l22 67h121l-29-117" fill="none" strokeWidth="12" />
            <path
              d="M80 125l104-50m-84 62l104-50"
              stroke="#8c9797"
              strokeWidth="7"
            />
          </g>
        )}
        {product.art === 'notebook' && (
          <g transform="translate(97 42) rotate(-9 100 100)">
            <rect
              x="15"
              y="12"
              width="150"
              height="190"
              rx="8"
              fill="#e8d3b0"
            />
            <rect x="0" y="0" width="150" height="190" rx="8" fill="#bd9778" />
            <path d="M18 0v190" />
            <rect x="40" y="39" width="79" height="40" rx="3" fill="#efdfc4" />
            <path d="M101 0v190" stroke="#7e654f" strokeWidth="4" />
          </g>
        )}
        {product.art === 'mug' && (
          <g transform="translate(113 66)">
            <path
              d="M144 33q81-9 59 69-15 39-59 13"
              fill="none"
              stroke="#baa57a"
              strokeWidth="16"
            />
            <path d="M0 23h150v108q0 39-75 39T0 131z" fill="#dfcda5" />
            <ellipse cx="75" cy="23" rx="75" ry="22" fill="#f3e5c4" />
            <ellipse cx="75" cy="25" rx="59" ry="13" fill="#6e5942" />
          </g>
        )}
        {product.art === 'mouse' && (
          <g transform="translate(129 38) rotate(15 65 100)">
            <path
              d="M0 80Q0 0 67 0t67 80v80q0 52-67 52T0 160z"
              fill="#c8b8b4"
            />
            <path d="M67 0v92M0 90h134" fill="none" />
            <rect x="58" y="34" width="17" height="34" rx="8" fill="#f0e4db" />
          </g>
        )}
      </g>
    </svg>
  );
}
