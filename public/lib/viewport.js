import * as Util from "./util.js";
import { app } from "./app.js";
export default class Viewport {
    constructor() {
        this.position = new Util.Point();
        this.scale = 1;
    }
    pan(dx, dy) {
        this.position.x += dx / this.scale;
        this.position.y += dy / this.scale;
    }
    panTo(x, y) {
        createjs.Tween.get(this.position).to({ x: -(x - (app.width / this.scale) / 2), y: -(y - (app.height / this.scale) / 2) }, 500, createjs.Ease.cubicOut);
    }
    zoom(cx, cy, d) {
        if (Util.inRange(this.scale - d, 0.1, 4) == false)
            return;
        this.pan(-cx, -cy);
        this.scale -= d;
        this.pan(cx, cy);
        app.ui.setZoomLevelPercentage(this.scale);
    }
    screenToViewport(x, y) {
        return new Util.Point(-this.position.x + x / this.scale, -this.position.y + y / this.scale);
    }
    viewportToScreen(x, y) {
        return new Util.Point((this.position.x + x) * this.scale, (this.position.y + y) * this.scale);
    }
    isRectInView(rect) {
        let topleft = this.screenToViewport(0, 0);
        let bottomRight = this.screenToViewport(window.innerWidth, window.innerHeight);
        return (!(rect.x > bottomRight.x || topleft.x > rect.x + rect.w ||
            rect.y > bottomRight.y || topleft.y > rect.y + rect.h));
    }
}
