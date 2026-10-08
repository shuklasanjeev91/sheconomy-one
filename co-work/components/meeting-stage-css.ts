import type { CoWorkShadows, CoWorkUiTokens } from '~/co-work/lib/theme'

/** Web meeting stage + tile styles (class names predate the SFU swap). */
export function getMeetingStageCss(ui: CoWorkUiTokens, shadows: CoWorkShadows) {
  return `
  .sheconomy-media-room {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    min-height: 100%;
    pointer-events: none;
  }
  .sheconomy-video-stage {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: ${ui.pageBg};
    padding: 88px 12px 112px;
    box-sizing: border-box;
    /* .sheconomy-media-room is pointer-events: none; the stage handles taps, swipes and wheel. */
    pointer-events: auto;
  }
  .sheconomy-video-stage--landscape-phone {
    /* Padding comes from inline layout vars — keep CSS padding as fallback only. */
    padding: var(--stage-pad-top, 62px) var(--stage-pad-right, 10px)
      var(--stage-pad-bottom, 82px) var(--stage-pad-left, 10px);
  }
  .sheconomy-video-stage--portrait-phone {
    padding: var(--stage-pad-top, 88px) var(--stage-pad-right, 12px)
      var(--stage-pad-bottom, 108px) var(--stage-pad-left, 12px);
  }
  .sheconomy-screen-share-status {
    position: absolute;
    top: 12px;
    left: 12px;
    right: auto;
    z-index: 20;
    transform: none;
    max-width: min(360px, calc(100% - 24px));
    padding: 8px 14px;
    border-radius: 12px;
    color: #ecfdf5;
    background: rgba(5, 150, 105, 0.92);
    border: 1px solid rgba(167, 243, 208, 0.48);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
    font-size: 12px;
    font-weight: 700;
    white-space: normal;
    line-height: 1.35;
    pointer-events: none;
  }
  .sheconomy-screen-share-status--viewing {
    background: rgba(37, 99, 235, 0.92);
    border-color: rgba(147, 197, 253, 0.5);
  }
  .sheconomy-screen-share-status--presenting {
    display: flex;
    align-items: center;
    gap: 10px;
    pointer-events: auto;
  }
  .sheconomy-screen-share-stop {
    flex-shrink: 0;
    padding: 6px 12px;
    border: 0;
    border-radius: 8px;
    background: #e02828;
    color: #fff;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }
  .sheconomy-screen-share-stop:hover {
    background: #c81e1e;
  }
  .sheconomy-video-gallery {
    display: grid;
    grid-template-columns: repeat(var(--gallery-cols, 1), minmax(0, 1fr));
    grid-template-rows: repeat(var(--gallery-rows, 1), minmax(0, 1fr));
    width: 100%;
    height: 100%;
    min-height: 0;
    gap: 10px;
    box-sizing: border-box;
    align-items: stretch;
    justify-items: stretch;
  }
  .sheconomy-video-gallery--solo {
    display: flex;
    align-items: stretch;
    justify-content: stretch;
  }
  .sheconomy-video-gallery--solo .sheconomy-participant-tile {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    flex: 1;
  }
  .sheconomy-video-pip {
    position: absolute;
    right: 20px;
    bottom: 120px;
    width: min(28vw, 240px);
    aspect-ratio: 16 / 9;
    z-index: 15;
    border-radius: ${ui.radius.tile}px;
    overflow: hidden;
    border: 1px solid ${ui.glassBorder};
    box-shadow: ${shadows.tile};
    background: ${ui.tileBg};
    pointer-events: auto;
  }
  .sheconomy-video-pip .sheconomy-participant-tile {
    width: 100%;
    height: 100%;
    border-radius: ${ui.radius.tile}px;
  }
  @media (max-width: 768px) {
    .sheconomy-video-pip {
      width: min(40vw, 148px);
      right: 12px;
      bottom: 112px;
    }
  }
  .sheconomy-participant-tile.lk-participant-tile {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    border-radius: ${ui.radius.tile}px;
    border: 1px solid ${ui.glassBorder};
    background: ${ui.tileBg};
    overflow: hidden;
    box-shadow: ${shadows.tile};
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .sheconomy-participant-tile video,
  .sheconomy-participant-tile .lk-video-track {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover;
    object-position: center center;
    background: #0c080a;
    display: block !important;
    position: absolute !important;
    inset: 0 !important;
    z-index: 1;
  }
  .sheconomy-participant-tile[data-sheconomy-video-fit='contain'] video,
  .sheconomy-participant-tile[data-sheconomy-video-fit='contain'] .lk-video-track {
    object-fit: contain;
  }
  .sheconomy-participant-tile[role='button'] {
    cursor: pointer;
  }
  /* Self-view only. */
  .sheconomy-participant-tile video.sheconomy-video--mirrored,
  .sheconomy-participant-tile .lk-video-track.sheconomy-video--mirrored {
    transform: scaleX(-1) !important;
  }
  .sheconomy-participant-tile[data-lk-source='screen_share'] video,
  .sheconomy-participant-tile[data-lk-source='screen_share'] .lk-video-track,
  .sheconomy-video-gallery--screen .sheconomy-participant-tile[data-lk-source='screen_share'] video {
    object-fit: contain !important;
    background: #0c080a;
    z-index: 2;
  }
  .sheconomy-video-gallery--screen {
    display: flex;
    align-items: stretch;
    justify-content: center;
  }
  .sheconomy-video-gallery--screen .sheconomy-participant-tile[data-lk-source='screen_share'] {
    width: 100%;
    height: 100%;
    flex: 1 1 auto;
  }
  .sheconomy-video-gallery--speaker {
    display: flex;
    align-items: stretch;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  .sheconomy-video-gallery--speaker .sheconomy-participant-tile {
    width: 100%;
    height: 100%;
    max-width: 100%;
    flex: 1 1 auto;
  }
  .sheconomy-video-stage--speaker.sheconomy-video-stage--filmstrip.sheconomy-video-stage--filmstrip-beside
    .sheconomy-video-gallery--speaker {
    margin-right: calc(var(--filmstrip-width, 176px) + 12px);
    width: calc(100% - var(--filmstrip-width, 176px) - 12px);
  }
  .sheconomy-video-stage--speaker.sheconomy-video-stage--filmstrip.sheconomy-video-stage--filmstrip-bottom
    .sheconomy-video-gallery--speaker {
    margin-right: 0;
    margin-bottom: calc(var(--filmstrip-height, 96px) + 8px);
    width: 100%;
    height: calc(100% - var(--filmstrip-height, 96px) - 8px);
  }
  .sheconomy-video-filmstrip {
    position: absolute;
    top: 88px;
    right: 12px;
    bottom: 112px;
    width: var(--filmstrip-width, 176px);
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    z-index: 12;
    pointer-events: auto;
    resize: horizontal;
    min-width: 144px;
    max-width: min(360px, 42vw);
    padding: 4px;
    border-radius: 12px;
    background: ${ui.glass};
    border: 1px solid ${ui.glassBorder};
    box-sizing: border-box;
  }
  .sheconomy-video-filmstrip__header {
    min-height: 30px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 2px 4px;
    color: ${ui.textSecondary};
    font-size: 11px;
    font-weight: 700;
    cursor: grab;
    user-select: none;
    touch-action: none;
  }
  .sheconomy-video-filmstrip__header:active {
    cursor: grabbing;
  }
  .sheconomy-video-filmstrip__header button {
    width: 28px;
    height: 28px;
    border: 1px solid ${ui.border};
    border-radius: 999px;
    color: ${ui.text};
    background: ${ui.surfaceMuted};
    cursor: pointer;
  }
  .sheconomy-video-filmstrip--minimized {
    width: 44px;
    min-width: 44px;
    height: 44px;
    bottom: auto;
    resize: none;
    overflow: hidden;
  }
  .sheconomy-video-filmstrip .sheconomy-participant-tile {
    width: 100%;
    min-height: 96px;
    flex: 0 0 110px;
  }
  .sheconomy-video-stage--filmstrip .sheconomy-video-gallery {
    margin-right: calc(var(--filmstrip-width, 176px) + 12px);
    width: calc(100% - var(--filmstrip-width, 176px) - 12px);
  }
  .sheconomy-video-stage--filmstrip-bottom.sheconomy-video-stage--filmstrip .sheconomy-video-gallery {
    margin-right: 0;
    margin-bottom: calc(var(--filmstrip-height, 92px) + 8px);
    width: 100%;
    height: calc(100% - var(--filmstrip-height, 92px) - 8px);
  }
  .sheconomy-video-stage--filmstrip-bottom.sheconomy-video-stage--filmstrip-minimized
    .sheconomy-video-gallery {
    margin-bottom: 52px;
    height: calc(100% - 52px);
  }
  .sheconomy-video-stage--filmstrip-beside .sheconomy-video-filmstrip {
    top: 0;
    right: 0;
    bottom: 0;
    left: auto;
    width: var(--filmstrip-width, 176px);
    height: auto;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    resize: horizontal;
    min-width: 104px;
    max-width: min(360px, 42vw);
  }
  .sheconomy-video-stage--filmstrip-bottom .sheconomy-video-filmstrip {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
    height: var(--filmstrip-height, 92px);
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    resize: none;
    min-width: 0;
    max-width: none;
    transform: none !important;
  }
  .sheconomy-video-stage--filmstrip-bottom .sheconomy-video-filmstrip--minimized {
    left: auto;
    width: 44px;
    min-width: 44px;
    height: 44px;
  }
  .sheconomy-video-stage--filmstrip-bottom .sheconomy-video-filmstrip__header {
    position: sticky;
    left: 0;
    flex: 0 0 auto;
    min-width: 36px;
  }
  .sheconomy-video-stage--filmstrip-bottom .sheconomy-video-filmstrip .sheconomy-participant-tile {
    width: 132px;
    min-width: 132px;
    min-height: 0;
    height: 84px;
    flex-basis: 132px;
  }
  .sheconomy-video-stage--landscape-phone .sheconomy-video-filmstrip {
    top: 0;
    right: 0;
    bottom: 0;
    min-width: 104px;
    max-width: 132px;
    resize: none;
  }
  .sheconomy-video-filmstrip__spacer {
    flex-shrink: 0;
    pointer-events: none;
  }
  .sheconomy-gallery-pagination {
    position: absolute;
    left: 50%;
    bottom: calc(var(--stage-pad-bottom, 112px) + 6px);
    transform: translateX(-50%);
    z-index: 18;
    display: flex;
    align-items: center;
    border-radius: 999px;
    padding: 5px 8px;
    background: rgba(12, 8, 10, 0.55);
    pointer-events: auto;
    transition: opacity 0.2s ease;
  }
  .sheconomy-video-stage--filmstrip-bottom.sheconomy-video-stage--filmstrip:not(
      .sheconomy-video-stage--filmstrip-minimized
    )
    .sheconomy-gallery-pagination {
    bottom: calc(var(--stage-pad-bottom, 112px) + var(--filmstrip-height, 92px) + 10px);
  }
  .sheconomy-gallery-pagination--hidden {
    opacity: 0;
    pointer-events: none;
  }
  .sheconomy-gallery-pagination__dots {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .sheconomy-gallery-pagination__dots .sheconomy-gallery-pagination__dot {
    width: 7px;
    height: 7px;
    min-width: 7px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.4);
    cursor: pointer;
  }
  .sheconomy-gallery-pagination__dots .sheconomy-gallery-pagination__dot--active {
    background: #fff;
  }
  /* Legacy narrow portrait fallback when policy classes are absent. */
  @media (max-width: 768px) and (orientation: portrait) {
    .sheconomy-video-stage:not(.sheconomy-video-stage--filmstrip-beside):not(
        .sheconomy-video-stage--filmstrip-bottom
      )
      .sheconomy-video-filmstrip {
      top: auto;
      left: 12px;
      right: 12px;
      bottom: 112px;
      width: auto;
      height: 92px;
      flex-direction: row;
      overflow-x: auto;
      overflow-y: hidden;
      resize: none;
      min-width: 0;
      max-width: none;
      transform: none !important;
      padding: 4px;
    }
    .sheconomy-video-stage:not(.sheconomy-video-stage--filmstrip-beside):not(
        .sheconomy-video-stage--filmstrip-bottom
      )
      .sheconomy-video-stage--filmstrip
      .sheconomy-video-gallery {
      margin-right: 0;
      margin-bottom: 100px;
      width: 100%;
      height: calc(100% - 100px);
    }
  }
  .sheconomy-video-gallery .lk-participant-placeholder {
    background: ${ui.tileBg};
  }
  .sheconomy-participant-tile .lk-participant-placeholder > svg,
  .sheconomy-participant-tile .lk-participant-placeholder > .lk-participant-name {
    display: none;
  }
  .sheconomy-participant-tile .lk-participant-placeholder[data-camera-off='true'] {
    opacity: 1;
  }
  .sheconomy-participant-tile[data-lk-source='screen_share'] .lk-participant-placeholder {
    /* Never paint the camera-off avatar over a screen-share tile. */
    background: #0c080a;
    z-index: 0;
  }
  .sheconomy-screen-waiting {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
  }
  .sheconomy-participant-avatar-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px;
  }
  .sheconomy-participant-avatar-wrap .sheconomy-participant-avatar-label,
  .sheconomy-participant-avatar-label {
    font-size: 12px;
    font-weight: 600;
    color: ${ui.textMuted};
  }
  .sheconomy-participant-tile.lk-participant-tile[data-lk-speaking='true'] {
    border-color: ${ui.brandLight};
    box-shadow: 0 0 0 2px ${ui.brandGlow}, ${shadows.tile};
  }
  .sheconomy-hand-raised {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 4;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    background: rgba(12, 8, 10, 0.78);
    border: 1px solid ${ui.brandLight};
    box-shadow: 0 0 0 2px ${ui.brandGlow};
  }
  .sheconomy-hand-raised-inline {
    margin-left: 6px;
  }
  .sheconomy-nonverbal {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 4;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    background: rgba(12, 8, 10, 0.78);
    border: 1px solid rgba(255,255,255,0.22);
  }
  .sheconomy-nonverbal-inline {
    margin-left: 6px;
  }
  .sheconomy-participant-tile .lk-participant-metadata {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 6;
    display: flex !important;
    opacity: 1 !important;
    visibility: visible !important;
    background: linear-gradient(180deg, transparent 0%, rgba(12, 8, 10, 0.92) 55%);
    padding: 12px 14px;
    backdrop-filter: blur(8px);
    pointer-events: none;
  }
  .sheconomy-participant-tile .lk-participant-metadata-item {
    /* Sits on the always-dark name gradient, not the themed tile. */
    color: #fff;
    font-size: 12px;
    font-weight: 600;
  }
  /* Keep the name chip readable over live video (not only camera-off). */
  .sheconomy-participant-tile .lk-participant-name {
    display: inline !important;
    opacity: 1 !important;
    color: #fff !important;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  }
  .sheconomy-participant-tile[data-lk-video-muted='true']:not([data-lk-source='screen_share'])
    .lk-participant-metadata {
    background: transparent;
    backdrop-filter: none;
  }
  .sheconomy-participant-tile[data-lk-video-muted='true']:not([data-lk-source='screen_share'])
    .lk-participant-metadata-item,
  .sheconomy-participant-tile[data-lk-video-muted='true']:not([data-lk-source='screen_share'])
    .lk-participant-name {
    color: ${ui.text} !important;
    text-shadow: none;
  }
  .sheconomy-participant-tile .lk-focus-toggle-button {
    display: none !important;
  }
  .sheconomy-participant-tile .lk-connection-quality,
  .sheconomy-connection-quality {
    display: inline-flex !important;
    opacity: 0.9 !important;
  }
  .sheconomy-tile-role {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 5;
  }
  .sheconomy-tile-focus-badges {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
    display: flex;
    gap: 6px;
    pointer-events: none;
  }
  .sheconomy-tile-badge {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    background: rgba(12, 8, 10, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.22);
  }
  .sheconomy-tile-badge--spotlight {
    color: #f5c542;
    border-color: rgba(245, 197, 66, 0.55);
  }
  .sheconomy-tile-menu {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 8;
  }
  .sheconomy-tile-menu-trigger {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: rgba(12, 8, 10, 0.78);
    color: #fff;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease;
  }
  .sheconomy-participant-tile:hover .sheconomy-tile-menu-trigger,
  .sheconomy-tile-menu-trigger:focus-visible,
  .sheconomy-tile-menu[data-open='true'] .sheconomy-tile-menu-trigger {
    opacity: 1;
  }
  .sheconomy-tile-menu-popover {
    position: absolute;
    top: 34px;
    right: 0;
    min-width: 176px;
    padding: 6px;
    border-radius: 12px;
    background: ${ui.surfaceElevated};
    border: 1px solid ${ui.border};
    box-shadow: ${shadows.panel};
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sheconomy-tile-menu-item {
    appearance: none;
    border: 0;
    background: transparent;
    color: ${ui.text};
    text-align: left;
    font-size: 12px;
    font-weight: 700;
    padding: 9px 10px;
    border-radius: 8px;
    cursor: pointer;
  }
  .sheconomy-tile-menu-item:hover {
    background: ${ui.brandMuted};
  }
  .sheconomy-speaking-indicator {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    border-radius: inherit;
    box-shadow: inset 0 0 0 3px ${ui.live};
  }
  .sheconomy-mic-muted {
    margin-right: 4px;
    font-size: 11px;
  }
  .sheconomy-video-gallery--grid {
    display: grid;
    grid-template-columns: repeat(var(--gallery-cols, 1), minmax(0, 1fr));
    grid-template-rows: repeat(var(--gallery-rows, 1), minmax(0, 1fr));
    width: 100%;
    height: 100%;
    min-height: 0;
    gap: 10px;
  }
  .sheconomy-video-gallery--scroll {
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    /* Mounted rows change while scrolling; anchoring would fight the offset. */
    overflow-anchor: none;
    align-content: start;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .sheconomy-video-gallery--scroll::-webkit-scrollbar {
    display: none;
  }
  .sheconomy-video-gallery--grid > .sheconomy-participant-tile,
  .sheconomy-video-gallery--grid > .lk-participant-tile {
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
  }
  .sheconomy-video-gallery .lk-pagination-control,
  .sheconomy-video-gallery .lk-pagination-indicator {
    color: ${ui.textSecondary};
  }
  .sheconomy-media-room .lk-control-bar,
  .sheconomy-media-room .lk-chat-toggle,
  .sheconomy-media-room .lk-settings-toggle,
  .sheconomy-media-room .lk-disconnect-button,
  .sheconomy-media-room .lk-button-group-menu,
  .sheconomy-media-room .lk-video-conference {
    display: none !important;
  }
  .sheconomy-participant-tile .lk-participant-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
    border-radius: inherit;
    z-index: 2;
  }
  .sheconomy-participant-tile .lk-participant-placeholder.sheconomy-screen-waiting {
    opacity: 1;
  }
  .sheconomy-participant-tile .lk-participant-metadata-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .sheconomy-meeting-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
`}
