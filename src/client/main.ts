import "./styles.css";
import { createCounter } from "./components/Counter";
import { createCredits } from "./components/Credits";
import { explode } from "./components/Explosion";
import { createFooter } from "./components/Footer";
import { createMaintenance } from "./components/Maintenance";
import { createMusicToggle } from "./components/MusicToggle";
import { createRain } from "./components/Rain";
import { createSfxToggle } from "./components/SfxToggle";
import { watchMotion } from "./lib/motion";
import { playBoom } from "./sfx";
import { addClick, refresh, startSync } from "./sync";

const counter = createCounter();
const credits = createCredits();
const maintenance = createMaintenance(refresh);
const rain = createRain((x, y) => {
  playBoom();
  explode(x, y);
  addClick();
  counter.flash();
});

const app = document.getElementById("app")!;
app.append(rain.el, counter.el, maintenance.el, createMusicToggle(), createSfxToggle(), createFooter(credits.open));
document.body.append(credits.el);

watchMotion();
rain.start();
startSync(({ stats, notice, maintenance: down }) => {
  counter.update(stats, notice);
  if (down) maintenance.show(down.until); else maintenance.hide();
});

let resizeTimer: ReturnType<typeof setTimeout> | undefined;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { rain.build(); counter.fit(); }, 150);
});
document.fonts.ready.then(counter.fit);
