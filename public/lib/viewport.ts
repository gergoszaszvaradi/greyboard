import * as Util from "./util.js"
import { app } from "./app.js";
import { createJsxAttribute } from "typescript";

export default class Viewport {

    position : Util.Point = new Util.Point();
    scale : number = 1;

    pan(dx : number, dy : number){
        this.position.x += dx / this.scale;
        this.position.y += dy / this.scale;
    }

    panTo(x : number, y : number){
        // @ts-ignore
        createjs.Tween.get(this.position).to({x: -(x - (app.width / this.scale) / 2), y: -(y - (app.height / this.scale) / 2)}, 500, createjs.Ease.cubicOut);
    }

    zoom(cx : number, cy : number, d : number){
        if(Util.inRange(this.scale - d, 0.1, 4) == false) return;
        this.pan(-cx, -cy);
        this.scale -= d;
        this.pan(cx, cy);
        app.ui.setZoomLevelPercentage(this.scale);
    }

    screenToViewport(x : number, y : number) : Util.Point {
        return new Util.Point(-this.position.x + x / this.scale, -this.position.y + y / this.scale);
    }

    viewportToScreen(x : number, y : number) : Util.Point {
        return new Util.Point((this.position.x + x) * this.scale, (this.position.y + y) * this.scale);
    }

    isRectInView(rect : Util.Rect) : boolean {
        let topleft = this.screenToViewport(0, 0);
        let bottomRight = this.screenToViewport(window.innerWidth, window.innerHeight);
        return (!(rect.x > bottomRight.x || topleft.x > rect.x + rect.w ||
                  rect.y > bottomRight.y || topleft.y > rect.y + rect.h));
    }
}