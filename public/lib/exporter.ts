import { app, board, socket } from "./app.js";
import Graphics from "./graphics.js";
import * as Util from "./util.js";

export default class Exporter {
    private static previewImageData : string = "";
    private static offScreenCanvas : Graphics;

    static download(url : string, filename : string){
        let a = document.createElement("a");
        a.href = url;
        a.setAttribute("download", filename);
        a.click();
    }

    static getPreviewImageData(padding : Util.Rect, scale : number) : string {
        let tg = app.graphics;
        if(this.offScreenCanvas == null) {
            let eCanvas = document.createElement("canvas");
            this.offScreenCanvas = new Graphics(eCanvas);
        }
        let bb = board.getBoundingBox();
        this.offScreenCanvas.resize(bb.w + padding.x + padding.w, bb.h + padding.y + padding.h);
        this.offScreenCanvas.clear("#222222");
        this.offScreenCanvas.setView(new Util.Point(-bb.x + padding.x, -bb.y + padding.y), scale);
        app.graphics = this.offScreenCanvas;
        board.drawAll();
        app.graphics = tg;
        this.previewImageData = this.offScreenCanvas.getImageData();
        return this.previewImageData;
    }

    static exportAsPNG(){
        this.download(this.previewImageData, "board_" + socket.bid + ".png");
    }
}