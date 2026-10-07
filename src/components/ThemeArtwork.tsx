/** Original line drawings: four memories, drawn as paths and sound contours. */
export default function ThemeArtwork({ variant }: { variant: number }) {
  return (
    <svg
      className="journey-artwork"
      viewBox="0 0 320 220"
      fill="none"
      aria-hidden="true"
    >
      <g
        className="art-contours"
        stroke="currentColor"
        strokeWidth=".65"
        opacity=".2"
      >
        {[0, 1, 2, 3].map((n) => (
          <ellipse
            key={n}
            cx="160"
            cy="114"
            rx={80 + n * 20}
            ry={42 + n * 14}
            transform="rotate(-24 160 114)"
          />
        ))}
      </g>
      <g
        className="art-scene"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {variant === 0 && (
          <>
            <circle
              cx="207"
              cy="58"
              r="24"
              fill="currentColor"
              fillOpacity=".1"
              strokeOpacity=".5"
            />
            <path d="M60 166h201M82 164V102l78-32 78 32v62M92 109h136M101 163v-43h25v43M148 164v-35a12 12 0 0 1 24 0v35M194 163v-43h25v43M112 97v-8M159 91v-8M206 97v-8" />
            <path
              d="m62 73 22-12 22 12-22 12-22-12Zm8 5v13l14 7 14-7V78M106 73v23M139 178h42"
              strokeOpacity=".65"
            />
          </>
        )}
        {variant === 1 && (
          <>
            <path
              d="M181 48a43 43 0 1 0 39 62 40 40 0 0 1-39-62Z"
              fill="currentColor"
              fillOpacity=".09"
            />
            <path
              d="M53 169h217M68 168v-24h31v24M117 168v-42h27v42M163 168v-25h31v25M211 168v-51h27v51"
              strokeOpacity=".7"
            />
            <path d="M237 55v12M231 61h12M93 59v8M89 63h8M261 89v8M257 93h8M135 88v7M132 92h6" />
            <circle cx="119" cy="49" r="1.5" fill="currentColor" />
          </>
        )}
        {variant === 2 && (
          <>
            <circle
              cx="213"
              cy="72"
              r="23"
              fill="currentColor"
              fillOpacity=".12"
              strokeOpacity=".5"
            />
            <path d="m53 151 63-59 34 34 29-25 86 64M67 165h198M105 104l12 17 10-7M169 112l10 16 14-14" />
            <path d="M159 210c-65-46 26-44-10-69" strokeWidth="2" />
            <path d="m69 58 22-7-9 22-3-12-10-3ZM91 51 79 61" />
            <path d="M225 126h31M228 136h46M53 183h65" strokeOpacity=".5" />
          </>
        )}
        {variant === 3 && (
          <>
            <path
              d="M100 103a25 25 0 0 1 7-49 33 33 0 0 1 60-5 25 25 0 0 1 28 43H100"
              fill="currentColor"
              fillOpacity=".06"
            />
            <path
              d="m112 118-7 13M139 115l-7 13M166 113l-7 13M96 141l-5 10M125 139l-5 10M155 138l-5 10"
              strokeOpacity=".75"
            />
            <path
              d="M56 175q28-15 56 0t56 0 56 0 56 0M42 191q28-15 56 0t56 0 56 0 56 0"
              strokeOpacity=".55"
            />
            <path
              d="M215 103v45M215 104l30-7v45M215 118l30-7"
              strokeWidth="2"
            />
            <ellipse
              cx="207"
              cy="148"
              rx="8"
              ry="5"
              fill="currentColor"
              fillOpacity=".25"
            />
            <ellipse
              cx="237"
              cy="142"
              rx="8"
              ry="5"
              fill="currentColor"
              fillOpacity=".25"
            />
          </>
        )}
      </g>
      <circle
        className="art-signal"
        cx="267"
        cy="47"
        r="3"
        fill="currentColor"
      />
      <path
        stroke="currentColor"
        strokeOpacity=".5"
        d="M18 18h18M18 18v18M302 202h-18M302 202v-18"
      />
    </svg>
  );
}
