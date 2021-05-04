import * as Util from "./util.js"

export default class Graphics {
    canvas : HTMLCanvasElement;
    ctx : CanvasRenderingContext2D;

    private cachedImages : {[key : string] : CanvasImageSource} = {};

    constructor(canvas : HTMLCanvasElement){
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
        this.ctx.textBaseline = "top";
    }

    setView(t : Util.Point, s : number){
        this.ctx.scale(s, s);
        this.ctx.translate(t.x, t.y);
    }
    resize(w : number, h : number) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.canvas.style.width = w + "px";
        this.canvas.style.height = h + "px";
    }

    stroke(color : string, weight : number = 0){
        if(weight > 0)
            this.ctx.lineWidth = weight;
        this.ctx.strokeStyle = color;
    }
    fill(color : string){
        this.ctx.fillStyle = color;
    }
    dash(segments : Array<number>){
        this.ctx.setLineDash(segments);
    }

    clear(color : string){
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
    }

    rect(x : number, y : number, w : number, h : number) {
        this.ctx.beginPath();
        this.ctx.rect(x, y, w, h);
        this.ctx.stroke();
        this.ctx.closePath();
    }
    fillRect(x : number, y : number, w : number, h : number) {
        this.ctx.fillRect(x, y, w, h);
    }

    ellipse(x : number, y : number, w : number, h : number){
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, w, h, 0, 0, 360);
        this.ctx.stroke();
        this.ctx.closePath();
    }
    fillEllipse(x : number, y : number, w : number, h : number){
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, w, h, 0, 0, 360);
        this.ctx.fill();
        this.ctx.closePath();
    }

    line(x1 : number, y1 : number, x2 : number, y2 : number) {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        this.ctx.closePath();
    }

    // fillRoundedRect(x : number, y : number, w : number, h : number, c1 : number, c2 : number = c1, c3 : number = c1, c4 : number = c1) {
    //     this.ctx.fillRect()
    // }

    curve(points : Array<Util.Point>){
        if(points == null || points.length == 0) return;

        if(points.length == 1){
            let fillstyle = this.ctx.fillStyle as string;
            this.fill(this.ctx.strokeStyle as string);
            this.fillEllipse(points[0].x, points[0].y, this.ctx.lineWidth / 2, this.ctx.lineWidth / 2);
            this.fill(fillstyle);
            return;
        }

        this.ctx.fillStyle = "#00000000";
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for(let i = 0; i < points.length-1; i++){
            let p1 = points[i], p2 = points[i+1];
            let mx = p1.x + (p2.x - p1.x) * 0.5;
            let my = p1.y + (p2.y - p1.y) * 0.5;
            this.ctx.quadraticCurveTo(p1.x, p1.y, mx, my);
        }
        this.ctx.lineTo(points[points.length-1].x, points[points.length-1].y);
        this.ctx.stroke();
        this.ctx.fill();
        this.ctx.closePath();
    }

    path(points : Array<Util.Point>, rect : Util.Rect){
        if(points == null || points.length == 0) return;

        if(points.length == 1){
            let fillstyle = this.ctx.fillStyle as string;
            this.fill(this.ctx.strokeStyle as string);
            this.fillEllipse(points[0].x + rect.x, points[0].y + rect.y, this.ctx.lineWidth / 2, this.ctx.lineWidth / 2);
            this.fill(fillstyle);
            return;
        }
        this.ctx.fillStyle = "#00000000";
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x * rect.w + rect.x, points[0].y * rect.h + rect.y);
        for(let i = 0; i < points.length-1; i++){
            let p1x = points[i].x * rect.w + rect.x;
            let p1y = points[i].y * rect.h + rect.y;
            let p2x = points[i+1].x * rect.w + rect.x;
            let p2y = points[i+1].y * rect.h + rect.y;
            let mx = p1x + (p2x - p1x) * 0.5;
            let my = p1y + (p2y - p1y) * 0.5;
            this.ctx.quadraticCurveTo(p1x, p1y, mx, my);
        }
        this.ctx.lineTo(points[points.length-1].x * rect.w + rect.x, points[points.length-1].y * rect.h + rect.y);
        this.ctx.stroke();
        this.ctx.fill();
        this.ctx.closePath();
    }

    polygon(points : Array<Util.Point>){
        if(points == null || points.length == 0) return;

        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for(let i = 1; i < points.length; i++){
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        this.ctx.lineTo(points[0].x, points[0].y);
        this.ctx.stroke();
        this.ctx.fill();
        this.ctx.closePath();
    }

    img(x : number, y : number, w : number, h : number, src : string | CanvasImageSource){
        if(typeof src === "string"){
            if(!(src in this.cachedImages)){
                let img = new Image();
                img.src = src;
                this.cachedImages[src] = img;
            }
            this.ctx.drawImage(this.cachedImages[src], x, y, w, h);
        }else{
            this.ctx.drawImage(src, x, y, w, h);
        }
    }

    font(family : string, size : number, halign : string = "left", valign : string = "top"){
        this.ctx.font = `${size}px ${family}`;
        this.ctx.textAlign = halign as CanvasTextAlign;
        this.ctx.textBaseline = valign as CanvasTextBaseline;
    }
    text(x : number, y : number, text : string){
        this.ctx.fillText(text, x, y);
    }
    textfield(x : number, y: number, w : number, text : string) {
        this.ctx.fillText(text, x, y, w);
    }


    getImageData(){
        return this.canvas.toDataURL("application/octet-stream");
    }
}