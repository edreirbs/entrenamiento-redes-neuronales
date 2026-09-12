import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setConcurrency(4);
// El entorno no tiene GPU: se renderiza por software y hay un Chromium ya
// instalado, así que no hace falta que Remotion baje el suyo.
Config.setChromiumOpenGlRenderer('swangle');
