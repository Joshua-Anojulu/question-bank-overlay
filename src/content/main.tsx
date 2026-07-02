import { isSupportedQuestionBankHost } from '../config/supportedHosts';
import { mountOverlay } from './overlayDom';
import './overlay.css';

const ROOT_ID = 'qbo-overlay-root';

if (isSupportedQuestionBankHost(window.location.hostname) && !document.getElementById(ROOT_ID)) {
  const rootElement = document.createElement('div');
  rootElement.id = ROOT_ID;
  document.documentElement.append(rootElement);
  mountOverlay(rootElement);
}
