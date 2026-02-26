/* ------------------------------------------------ */
/* TV FULLSCREEN PAGE (FIXED HEIGHT)                */
/* ------------------------------------------------ */

import { TVContent } from "../tv/TVContent";

/* ------------------------------------------------ */
/* COMPONENT                                        */
/* ------------------------------------------------ */

function TVFullscreen() {
  return (
    <div className="h-screen w-screen p-6 bg-background flex flex-col">
      <div className="flex-1 min-h-0">
        <TVContent isFullscreen />
      </div>
    </div>
  );
}

/* ------------------------------------------------ */
/* EXPORT                                           */
/* ------------------------------------------------ */

export default TVFullscreen;
