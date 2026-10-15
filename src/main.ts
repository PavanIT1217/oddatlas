import './style.css';
import { App } from './app';
import { registerServiceWorker } from './pwa/register';

new App().start();
registerServiceWorker();
