// Иконки (SVG-пути из Material Design Icons) — работают и внутри SVG карты, и в интерфейсе
import {
  mdiCrown, mdiCastle, mdiHomeVariant, mdiBarn, mdiChessRook, mdiPillar, mdiCircleDouble, mdiDiamondStone,
  mdiTreasureChest, mdiSkull, mdiAlert, mdiExclamationThick, mdiTowerFire, mdiShieldSword, mdiSword, mdiHorse,
  mdiSailBoat, mdiFlag, mdiPaw, mdiWizardHat, mdiAutoFix, mdiCandle, mdiSpiderWeb, mdiCursorDefault,
  mdiVectorPolyline, mdiBrush, mdiEraser, mdiLasso, mdiPlus, mdiMinus, mdiMagnify, mdiLayers, mdiClose, mdiLogin,
  mdiLogout, mdiCog, mdiBookOpenPageVariant, mdiMap, mdiUndo, mdiDelete, mdiEye, mdiEyeOff, mdiClockOutline,
  mdiPlay, mdiStop, mdiCrosshairsGps, mdiImageFilterHdr, mdiWaves, mdiTerrain, mdiTree, mdiFlagVariant, mdiTextBox,
  mdiDownload, mdiMapMarkerPath, mdiAccountGroup, mdiCloud, mdiCloudOff, mdiFormatColorFill, mdiChevronLeft,
  mdiChevronRight, mdiPencil, mdiFitToScreen, mdiWeatherWindy, mdiRoadVariant, mdiAnchor, mdiCheck, mdiTimerSand,
  mdiArrowRightBold, mdiNoteText, mdiLock, mdiMenu, mdiStarFourPoints, mdiMapMarkerPlus, mdiCreation, mdiShape,
  mdiHelpCircleOutline, mdiMapMarker, mdiRuler, mdiFormatText, mdiGrid, mdiVolumeHigh, mdiVolumeOff,
  mdiWeatherPartlyCloudy, mdiMoonWaningCrescent, mdiThermometer, mdiBullseyeArrow, mdiCursorDefaultOutline
} from '@mdi/js'

export const ICONS = {
  // города
  crown: mdiCrown, castle: mdiCastle, home: mdiHomeVariant, barn: mdiBarn, fort: mdiChessRook, ruins: mdiPillar,
  // точки
  portal: mdiCircleDouble, artifact: mdiAutoFix, lair: mdiSpiderWeb, shrine: mdiCandle, crystal: mdiDiamondStone,
  danger: mdiAlert, quest: mdiExclamationThick, treasure: mdiTreasureChest, tower: mdiTowerFire,
  // отряды
  sword: mdiSword, shield: mdiShieldSword, horse: mdiHorse, ship: mdiSailBoat, flag: mdiFlag, paw: mdiPaw,
  skull: mdiSkull, wizard: mdiWizardHat,
  // интерфейс
  select: mdiCursorDefault, road: mdiVectorPolyline, roadType: mdiRoadVariant, brush: mdiBrush, eraser: mdiEraser,
  lasso: mdiLasso, plus: mdiPlus, minus: mdiMinus, search: mdiMagnify, layers: mdiLayers, close: mdiClose,
  login: mdiLogin, logout: mdiLogout, settings: mdiCog, wiki: mdiBookOpenPageVariant, map: mdiMap, undo: mdiUndo,
  delete: mdiDelete, eye: mdiEye, eyeOff: mdiEyeOff, clock: mdiClockOutline, play: mdiPlay, stop: mdiStop,
  locate: mdiCrosshairsGps, relief: mdiImageFilterHdr, rivers: mdiWaves, heights: mdiTerrain, biomes: mdiTree,
  states: mdiFlagVariant, labels: mdiTextBox, download: mdiDownload, journey: mdiMapMarkerPath, party: mdiAccountGroup,
  fog: mdiCloud, fogOff: mdiCloudOff, fill: mdiFormatColorFill, left: mdiChevronLeft, right: mdiChevronRight,
  edit: mdiPencil, fit: mdiFitToScreen, zone: mdiWeatherWindy, anchor: mdiAnchor, check: mdiCheck, timer: mdiTimerSand,
  arrow: mdiArrowRightBold, note: mdiNoteText, lock: mdiLock, menu: mdiMenu, star: mdiStarFourPoints,
  cityAdd: mdiMapMarkerPlus, anomaly: mdiCreation, shape: mdiShape, help: mdiHelpCircleOutline,
  ping: mdiMapMarker, ruler: mdiRuler, label: mdiFormatText, grid: mdiGrid, soundOn: mdiVolumeHigh, soundOff: mdiVolumeOff,
  weather: mdiWeatherPartlyCloudy, moon: mdiMoonWaningCrescent, temp: mdiThermometer, pingTool: mdiBullseyeArrow,
  cursors: mdiCursorDefaultOutline
}
