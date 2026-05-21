import { useTranslation } from 'react-i18next';
import { useFloorPlan } from '../../stores/floor-plan';

/**
 * Overlay button that toggles the 3D tour camera mode between orbit and
 * first-person walk. Rendered OUTSIDE the R3F `<Canvas>` as a plain DOM
 * element positioned over the scene.
 *
 * The button click is the user gesture required for PointerLockControls to
 * request pointer lock. Don't try to auto-lock on mount — browsers require
 * a real gesture.
 */
export function TourModeToggle() {
  const { t } = useTranslation();
  const tourMode = useFloorPlan((s) => s.tourMode);
  const setTourMode = useFloorPlan((s) => s.setTourMode);

  const isWalk = tourMode === 'walk';

  function handleClick() {
    setTourMode(isWalk ? 'orbit' : 'walk');
  }

  return (
    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
      {/* Mode badge — used by E2E tests to assert visible state */}
      <span
        data-testid="tour-mode-badge"
        className="rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white"
      >
        {isWalk ? t('tour.modeWalk') : t('tour.modeOrbit')}
      </span>

      <button
        type="button"
        data-testid="tour-mode-toggle"
        onClick={handleClick}
        className="rounded-md bg-black/60 px-3 py-1.5 text-sm font-medium text-white hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        aria-label={isWalk ? t('tour.switchToOrbit') : t('tour.switchToWalk')}
        aria-pressed={isWalk}
      >
        {isWalk ? t('tour.modeBadgeOrbit') : t('tour.modeBadgeWalk')}
      </button>
    </div>
  );
}
