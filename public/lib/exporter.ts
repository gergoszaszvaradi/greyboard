import e from "express";
import { app, board, socket } from "./app.js";
import Graphics from "./graphics.js";
import * as Util from "./util.js";

export default class Exporter{
    static download(url : string, filename : string){
        let a = document.createElement("a");
        a.href = url;
        a.setAttribute("download", filename);
        a.click();
    }

    static exportAsGB(){
    }

    static exportAsPNG(){
        let tg = app.graphics;
        let eCanvas = document.createElement("canvas");
        let g = new Graphics(eCanvas);

        let bb = board.getBoundingBox();
        g.resize(bb.w + 100, bb.h + 100);
        g.clear("#222222");
        g.setView(new Util.Point(-bb.x + 50, -bb.y + 50), 1);
        app.graphics = g;
        board.drawAll();
        app.graphics = tg;
        let data = g.getImageData();

        this.download(data, "board_" + socket.bid + ".png");
    }
}