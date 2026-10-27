export default function LoginAccessIcon() {
  const arrowPath = "M-14-4H1v-8L15 0 1 12V4h-15z";
  const arcPath = "M32 22.68a20 20 0 1 1 0 34.64";

  return (
    <div className="invitationHeadingIcon loginAccessIcon" aria-hidden="true">
      <span className="loginAccessStage">
        <svg viewBox="0 0 80 80" fill="none" focusable="false">
          <g className="loginAccessSwimmer">
            <path d={arrowPath} fill="currentColor" />
          </g>
          {/* The arc separates the return layer from the outward layer. */}
          <path className="loginAccessArcGap" d={arcPath} stroke="var(--login-icon-arc-gap, #e5eee2)" strokeWidth="9" />
          <path d={arcPath} stroke="currentColor" strokeWidth="5.5" />
          <g className="loginAccessSwimmer loginAccessSwimmerFront">
            <path d={arrowPath} fill="currentColor" />
          </g>
          <path
            className="loginAccessRestArrow"
            d="M11 36h15v-8l14 12-14 12v-8H11z"
            fill="currentColor"
          />
        </svg>
      </span>
    </div>
  );
}
