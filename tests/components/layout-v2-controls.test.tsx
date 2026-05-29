// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../src/lib/i18n';
import { resetForTests, useFloorPlan } from '../../src/stores/floor-plan';
import { LayoutModeToggle } from '../../src/components/editor/LayoutModeToggle';
import { FloorSelector } from '../../src/components/editor/FloorSelector';

beforeEach(() => resetForTests());

describe('layout v2 controls', () => {
  it('switches from classic to advanced layout mode', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LayoutModeToggle />
      </I18nextProvider>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /Advanced layout|Layout lanjutan/ }),
    );

    expect(useFloorPlan.getState().layoutMode).toBe('advanced');
  });

  it('adds a floor from the floor selector', async () => {
    useFloorPlan.setState({
      layoutV2: {
        version: 2,
        activeFloorId: 'floor-1',
        floors: [{ id: 'floor-1', name: 'Lantai 1', level: 1, elevationM: 0 }],
        areas: [],
        walls: [],
        openings: [],
      },
    });
    render(
      <I18nextProvider i18n={i18n}>
        <FloorSelector />
      </I18nextProvider>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /Add floor|Tambah lantai/ }),
    );

    expect(useFloorPlan.getState().layoutV2?.floors).toHaveLength(2);
  });

  it('adds an outdoor layout area from the inspector with localized terrain options', async () => {
    useFloorPlan.setState({
      layoutV2: {
        version: 2,
        activeFloorId: 'floor-1',
        floors: [{ id: 'floor-1', name: 'Lantai 1', level: 1, elevationM: 0 }],
        areas: [],
        walls: [],
        openings: [],
      },
    });
    const { LayoutInspectorPanel } =
      await import('../../src/components/editor/LayoutInspectorPanel');

    render(
      <I18nextProvider i18n={i18n}>
        <LayoutInspectorPanel />
      </I18nextProvider>,
    );

    await userEvent.click(
      screen.getByRole('button', {
        name: /Tambah area teras|Add terrace area/,
      }),
    );

    expect(useFloorPlan.getState().layoutV2?.areas[0]).toMatchObject({
      zoneType: 'terrace',
    });
    expect(screen.getByRole('option', { name: /Rumput|Grass/ })).toBeVisible();
  });

  it('shows opening controls for a selected wall', async () => {
    useFloorPlan.getState().loadProject({
      id: 'project-1',
      name: 'Rumah',
      templateId: null,
      budgetTier: 'standar',
      contingencyPct: 0.1,
      taxEnabled: false,
      climateZone: 'tropical_indonesia',
      styleTag: null,
      floorPlanImageUrl: null,
      shareToken: null,
      shareTokenExpiry: null,
      zones: [
        {
          id: 'z1',
          type: 'living_room',
          name: 'Ruang Tamu',
          x: 0,
          y: 0,
          width: 80,
          height: 60,
        },
      ],
      placedItems: [],
      createdAt: 1,
      updatedAt: 2,
    });
    const wallId = useFloorPlan.getState().layoutV2!.walls[0]!.id;
    useFloorPlan.getState().selectLayoutWall(wallId);
    const { LayoutInspectorPanel } =
      await import('../../src/components/editor/LayoutInspectorPanel');

    render(
      <I18nextProvider i18n={i18n}>
        <LayoutInspectorPanel />
      </I18nextProvider>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /Tambah pintu|Add door/ }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Tambah jendela|Add window/ }),
    );

    expect(screen.getByLabelText(/Offset pintu|Door offset/)).toBeVisible();
    expect(
      screen.getByLabelText(/Offset pintu 1|Door offset 1/),
    ).toBeVisible();
    expect(
      screen.getByLabelText(/Lebar bukaan 2|Opening width 2/),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Hapus bukaan 2|Remove opening 2/ }),
    ).toBeVisible();
    expect(useFloorPlan.getState().layoutV2?.openings).toHaveLength(2);
  });
});
