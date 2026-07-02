import { COLLEGE_BOARD_QUESTION_BANK_HOST } from '../config/supportedHosts';
import { mountOverlay } from './overlayDom';
import './overlay.css';

const ROOT_ID = 'qbo-overlay-root';

if (window.location.hostname === COLLEGE_BOARD_QUESTION_BANK_HOST && !document.getElementById(ROOT_ID)) {
  const rootElement = document.createElement('div');
  rootElement.id = ROOT_ID;
  document.documentElement.append(rootElement);
  mountOverlay(rootElement);
}
